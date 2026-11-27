import { DOCUMENT_LANGUAGE } from "#/config/site.ts";
import { languageAttributeFor } from "#/lib/language.ts";

/**
 * Returns the `lang` attribute for text formatted by `format`, or `undefined` when it matches the document language.
 */
export const languageAttributeInDocumentFor = (format: Intl.DateTimeFormat | Intl.NumberFormat) =>
  languageAttributeFor(format, DOCUMENT_LANGUAGE);
