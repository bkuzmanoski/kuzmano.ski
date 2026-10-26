import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { codeFenceAttributesIn } from "./code-fence-attributes.ts";

const ENTRY_FILE = { path: fromContent("collection", "entry.mdx") };

describe("codeFenceAttributesIn", () => {
  test.each([
    { description: "a missing", meta: null },
    { description: "a whitespace-only", meta: "  " },
  ])("returns an empty map for $description meta string", ({ meta }) => {
    expect(codeFenceAttributesIn(meta, ENTRY_FILE)).toEqual(new Map());
  });

  test("returns the value of an unquoted `name=value` pair", () => {
    expect(codeFenceAttributesIn("gist=0123abcd", ENTRY_FILE)).toEqual(new Map([["gist", "0123abcd"]]));
  });

  test('returns the value of a quoted `name="value"` pair without its quotation marks', () => {
    expect(codeFenceAttributesIn(' gist="0123abcd" ', ENTRY_FILE)).toEqual(new Map([["gist", "0123abcd"]]));
  });

  test("throws for text that is not a `name=value` pair, naming the entry and the text", () => {
    expect(() => codeFenceAttributesIn("gist=0123abcd {1,3}", ENTRY_FILE)).toThrow(
      '"content/collection/entry.mdx" has a code fence with "{1,3}" in its meta string. Expected `name=value` or `name="value"` pairs.',
    );
  });

  test("throws for an unsupported attribute, naming the entry and the attribute", () => {
    expect(() => codeFenceAttributesIn('title="value.ts"', ENTRY_FILE)).toThrow(
      '"content/collection/entry.mdx" has a code fence that sets the attribute "title".',
    );
  });

  test("throws for an attribute set twice, naming the attribute", () => {
    expect(() => codeFenceAttributesIn("gist=0123abcd gist=4567cdef", ENTRY_FILE)).toThrow(
      "sets the attribute `gist` more than once",
    );
  });

  test("throws for a `gist` value with a character other than a lowercase hexadecimal digit, naming the value", () => {
    expect(() => codeFenceAttributesIn("gist=0123ABCD", ENTRY_FILE)).toThrow('sets `gist` to "0123ABCD"');
  });
});
