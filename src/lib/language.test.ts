import { describe, expect, test } from "vitest";

import { languageAttributeFor } from "./language.ts";

describe("languageAttributeFor", () => {
  test("returns `undefined` for a formatter whose locale is in the document's language", () => {
    expect(languageAttributeFor(new Intl.DateTimeFormat("en-AU"), "en")).toBeUndefined();
    expect(languageAttributeFor(new Intl.NumberFormat("en-US"), "en")).toBeUndefined();
  });

  test("returns the formatter's locale when its language differs from the document's", () => {
    expect(languageAttributeFor(new Intl.DateTimeFormat("de-DE"), "en")).toBe("de-DE");
    expect(languageAttributeFor(new Intl.NumberFormat("de-DE"), "en")).toBe("de-DE");
  });
});
