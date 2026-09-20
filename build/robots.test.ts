import { describe, expect, test } from "vitest";

import { CONTENT_SIGNAL, SITE_URL } from "#/config/site.ts";

import { robotsText } from "./robots.ts";

describe("robotsText", () => {
  const robots = robotsText();

  test("begins with the Content Signals Policy, written as comments", () => {
    const policy = robots.slice(0, robots.indexOf("\nUser-Agent:"));

    expect(policy).toContain("# As a condition of accessing this website");
    expect(policy.split("\n").filter((line) => line !== "" && !line.startsWith("#"))).toStrictEqual([]);
  });

  test("allows every crawler to read every path", () => {
    expect(robots).toContain("\nUser-Agent: *\n");
    expect(robots).toContain("\nAllow: /\n");
  });

  test("declares the site's content signals", () => {
    expect(robots).toContain(`\nContent-Signal: ${CONTENT_SIGNAL}\n`);
  });

  test("declares the sitemap by its absolute URL", () => {
    expect(robots).toContain(`\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  });

  test("ends with a single trailing newline", () => {
    expect(robots.endsWith("\n")).toBe(true);
    expect(robots.endsWith("\n\n")).toBe(false);
  });
});
