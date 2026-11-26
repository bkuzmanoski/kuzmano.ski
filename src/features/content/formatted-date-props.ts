import { formatDate } from "#/lib/datetime.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";

/**
 * Returns props to render `date` as text using `format`. The `lang` attribute accounts for the formatted text in a
 * different language from that of the document.
 */
export const formattedDatePropsOf = (date: string, format: Intl.DateTimeFormat) => ({
  lang: languageAttributeInDocumentFor(format),
  // `suppressHydrationWarning` prevents hydration failure when build and browser locale data format the same date
  // differently (e.g., "Sept" in Node and "Sep" in Safari for `en-AU`). This avoids a document re-render that would
  // remove `<html>` attributes set by pre-hydration scripts.
  suppressHydrationWarning: true,
  children: formatDate(date, format),
});
