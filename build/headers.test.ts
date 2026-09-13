import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { addHeadersRules, headersRuleText, headersWithRules } from "./headers.ts";

import type { HeadersRule } from "./headers.ts";

const CACHE_RULE: HeadersRule = {
  description: "A cached path.",
  pathPatterns: ["/cached/*"],
  headers: { "Cache-Control": "public, max-age=31536000, immutable" },
};
const TYPED_RULE: HeadersRule = {
  description: "Typed paths.",
  pathPatterns: ["/first.txt", "/second.txt"],
  headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
};
const TYPED_RULE_TEXT = `# Typed paths.
/first.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex
/second.txt
  Content-Type: text/plain; charset=utf-8
  X-Robots-Tag: noindex`;

describe("headersRuleText", () => {
  test("writes each path pattern with every header, under the rule's description", () => {
    expect(headersRuleText(TYPED_RULE)).toBe(TYPED_RULE_TEXT);
  });
});

describe("headersWithRules", () => {
  test("writes the rules alone, separated by a blank line, into an empty file", () => {
    expect(headersWithRules("", [CACHE_RULE, TYPED_RULE])).toBe(
      `${headersRuleText(CACHE_RULE)}\n\n${headersRuleText(TYPED_RULE)}\n`,
    );
  });

  test("adds rules after the rules the file already contains", () => {
    const headersFileText = `${headersRuleText(CACHE_RULE)}\n`;
    expect(headersWithRules(headersFileText, [TYPED_RULE])).toBe(
      `${headersRuleText(CACHE_RULE)}\n\n${headersRuleText(TYPED_RULE)}\n`,
    );
  });

  test("adds a rule once to a file that already contains it", () => {
    const headersFileText = headersWithRules("", [CACHE_RULE]);
    expect(headersWithRules(headersFileText, [CACHE_RULE])).toBe(headersFileText);
  });
});

describe("addHeadersRules", () => {
  test("creates the `_headers` file in an output directory without one, then adds rules to it", async () => {
    const outputDirectoryAbsolutePath = await mkdtemp(join(tmpdir(), "headers-"));

    try {
      await addHeadersRules(outputDirectoryAbsolutePath, [CACHE_RULE]);
      await addHeadersRules(outputDirectoryAbsolutePath, [TYPED_RULE]);

      await expect(readFile(join(outputDirectoryAbsolutePath, "_headers"), "utf8")).resolves.toBe(
        headersWithRules("", [CACHE_RULE, TYPED_RULE]),
      );
    } finally {
      await rm(outputDirectoryAbsolutePath, { recursive: true, force: true });
    }
  });
});
