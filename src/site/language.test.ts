import { describe, expect, test } from "vitest";

import { DOCUMENT_LANGUAGE } from "#/config/site.ts";

import { languageAttributeInDocumentFor } from "./language.ts";

describe("languageAttributeInDocumentFor", () => {
  test("returns `undefined` for a formatter whose locale is in the document language", () => {
    expect(languageAttributeInDocumentFor(new Intl.DateTimeFormat(DOCUMENT_LANGUAGE))).toBeUndefined();
  });

  test("returns the formatter's locale when its language differs from the document language", () => {
    expect(languageAttributeInDocumentFor(new Intl.NumberFormat("de-DE"))).toBe("de-DE");
  });
});
