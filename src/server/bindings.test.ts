import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "jsonc-parser";
import { describe, expect, test } from "vitest";

import { isRecord } from "#/lib/guards.ts";

import {
  RATE_LIMIT_BINDINGS,
  RATE_LIMIT_SECTION,
  SECRET_BINDINGS,
  SEND_EMAIL_BINDING,
  SEND_EMAIL_SECTION,
} from "./bindings.ts";

const wranglerConfig: unknown = parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
const environmentExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

// The bindings `wrangler.jsonc` declares under `section`, in the order it declares them.
function declaredIn(section: string): Array<Record<string, unknown>> {
  const declaredSection = isRecord(wranglerConfig) ? wranglerConfig[section] : undefined;
  return Array.isArray(declaredSection) ? (declaredSection as Array<unknown>).filter(isRecord) : [];
}

const declaredNames = (section: string): Array<string> =>
  declaredIn(section).flatMap((binding) => (typeof binding.name === "string" ? [binding.name] : []));

const allDeclaredNames = [...declaredNames(SEND_EMAIL_SECTION), ...declaredNames(RATE_LIMIT_SECTION)];
const plainTextVariables = isRecord(wranglerConfig) && isRecord(wranglerConfig.vars) ? wranglerConfig.vars : {};

describe.each([
  { section: SEND_EMAIL_SECTION, read: [SEND_EMAIL_BINDING] },
  { section: RATE_LIMIT_SECTION, read: RATE_LIMIT_BINDINGS },
])("$section", ({ section, read }) => {
  // Compared in both directions: a binding the application reads but wrangler does not declare resolves
  // to `undefined` at runtime, and one wrangler declares that nothing reads is provisioned for no reason.
  test("wrangler.jsonc declares exactly the bindings the application reads", () => {
    expect([...declaredNames(section)].sort()).toEqual([...read].sort());
  });
});

test.each(SECRET_BINDINGS)("%s is set as a secret rather than declared in wrangler.jsonc", (name) => {
  expect(allDeclaredNames).not.toContain(name);
  expect(plainTextVariables).not.toHaveProperty(name);
});

test.each(SECRET_BINDINGS)("%s is set in .env.example, for local development", (name) => {
  expect(environmentExample).toMatch(new RegExp(`^${name}=`, "m"));
});

test("the send email binding does not pin a destination email address", () => {
  expect(declaredIn(SEND_EMAIL_SECTION)[0] ?? {}).not.toHaveProperty("destination_address");
});
