import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "jsonc-parser";
import { describe, expect, test } from "vitest";

import { isRecord } from "#/lib/guards.ts";

import {
  ASSETS_BINDING,
  ASSETS_SECTION,
  RATE_LIMIT_BINDINGS,
  RATE_LIMIT_SECTION,
  SECRET_BINDINGS,
  SEND_EMAIL_BINDING,
  SEND_EMAIL_SECTION,
} from "./bindings.ts";

const REGEXP_SPECIAL_CHARACTERS = /[-/\\^$*+?.()|[\]{}]/g;

const wranglerConfig: unknown = parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
const environmentExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

// Cloudflare treats `*` as matching `/` and evaluates negative rules before positive rules.
const ruleMatches = (rule: string, pathname: string) =>
  new RegExp(
    `^${rule
      .split("*")
      .map((part) => part.replace(REGEXP_SPECIAL_CHARACTERS, String.raw`\$&`))
      .join(".*")}$`,
  ).test(pathname);

function runsWorkerFirst(pathname: string): boolean {
  const assets = isRecord(wranglerConfig) ? wranglerConfig[ASSETS_SECTION] : undefined;
  const declaredRules = isRecord(assets) ? assets.run_worker_first : undefined;
  const rules = Array.isArray(declaredRules) ? declaredRules.filter((rule) => typeof rule === "string") : [];
  const servedAsAFile = rules
    .filter((rule) => rule.startsWith("!/"))
    .some((rule) => ruleMatches(rule.slice(1), pathname));

  return !servedAsAFile && rules.filter((rule) => rule.startsWith("/")).some((rule) => ruleMatches(rule, pathname));
}

// The bindings `wrangler.jsonc` declares under `section`, in the order it declares them.
function declaredIn(section: string): Array<Record<string, unknown>> {
  const declaredSection = isRecord(wranglerConfig) ? wranglerConfig[section] : undefined;
  return Array.isArray(declaredSection) ? (declaredSection as Array<unknown>).filter(isRecord) : [];
}

const declaredNames = (section: string): Array<string> =>
  declaredIn(section).flatMap((binding) => (typeof binding.name === "string" ? [binding.name] : []));

const allDeclaredNames = [...declaredNames(SEND_EMAIL_SECTION), ...declaredNames(RATE_LIMIT_SECTION)];
const plainTextVariables = isRecord(wranglerConfig) && isRecord(wranglerConfig.vars) ? wranglerConfig.vars : {};

test("`wrangler.jsonc` names a `main` bundle whose Worker entry exists in `/src`", () => {
  const main = isRecord(wranglerConfig) ? wranglerConfig.main : undefined;
  const entryName = typeof main === "string" ? /^dist\/server\/(.+)\.js$/.exec(main)?.[1] : undefined;

  expect(entryName).toBeDefined();
  expect(existsSync(join(process.cwd(), "src", `${entryName ?? ""}.ts`))).toBe(true);
});

test("`wrangler.jsonc` binds the static assets under the name the application reads", () => {
  const assets = isRecord(wranglerConfig) ? wranglerConfig[ASSETS_SECTION] : undefined;
  expect(isRecord(assets) ? assets.binding : undefined).toBe(ASSETS_BINDING);
});

describe("`wrangler.jsonc` routes a request", () => {
  test.each([
    ["a page", "/page"],
    ["a collection", "/collection"],
    ["a collection entry", "/collection/entry"],
    ["a Markdown file", "/page.md"],
    ["an API route", "/api/endpoint"],
    ["the site root", "/"],
  ])("to the Worker, for %s", (_label, pathname) => {
    expect(runsWorkerFirst(pathname)).toBe(true);
  });

  test.each([
    ["hashed build output", "/assets/index-0123abcd.js"],
    ["a hashed stylesheet", "/assets/index-0123abcd.css"],
    ["a media rendition", "/media/0123456789abcdef.01234567.webp"],
    ["a site icon", "/favicon.ico"],
    ["the web app manifest", "/manifest.json"],
    ["a feed", "/collection/feed.xml"],
    ["a prerendered document file", "/page/index.html"],
    ["`robots.txt`", "/robots.txt"],
  ])("to the Asset Worker, for %s", (_label, pathname) => {
    expect(runsWorkerFirst(pathname)).toBe(false);
  });
});

describe.each([
  { section: SEND_EMAIL_SECTION, read: [SEND_EMAIL_BINDING] },
  { section: RATE_LIMIT_SECTION, read: RATE_LIMIT_BINDINGS },
])("$section", ({ section, read }) => {
  test("`wrangler.jsonc` declares exactly the bindings the application reads", () => {
    expect([...declaredNames(section)].sort()).toEqual([...read].sort());
  });
});

test("the send email binding does not pin a destination email address", () => {
  expect(declaredIn(SEND_EMAIL_SECTION)[0] ?? {}).not.toHaveProperty("destination_address");
});

test.each(SECRET_BINDINGS)("%s is not declared in `wrangler.jsonc` as a binding or a plain-text variable", (name) => {
  // Secrets are set outside `wrangler.jsonc`, so their values are never committed.
  expect(allDeclaredNames).not.toContain(name);
  expect(plainTextVariables).not.toHaveProperty(name);
});

test.each(SECRET_BINDINGS)("%s is set in `.env.example`", (name) => {
  expect(environmentExample).toMatch(new RegExp(`^${name}=`, "m"));
});
