import { DOCUMENT_LANGUAGE } from "#/config/site.ts";
import { languageAttributeFor } from "#/lib/language.ts";

/**
 * The `lang` attribute for text formatted by `format` in a document, or `undefined` when its locale is
 * in the document language (see `languageAttributeFor`).
 */
export const languageAttributeInDocumentFor = (format: Intl.DateTimeFormat | Intl.NumberFormat) =>
  languageAttributeFor(format, DOCUMENT_LANGUAGE);
