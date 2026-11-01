import { formatDate } from "#/lib/datetime.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";

import type { ComponentProps } from "react";

/**
 * Renders `date` formatted by `format` in a `<time>`. A format in the browser's locale can produce text in a language
 * other than that of the document, so the `<time>` takes the `lang` attribute returned by
 * `languageAttributeInDocumentFor`.
 *
 * The locale data of the build and the browser can write a date differently in the same locale (e.g., "Sept" in Node
 * and "Sep" in Safari for `en-AU`). `suppressHydrationWarning` prevents that difference from failing hydration, which
 * would make React render the whole document again and remove the attributes that the pre-hydration scripts set on
 * `<html>`.
 */
export function FormattedDate({
  date,
  format,
  ...timeProps
}: { date: string; format: Intl.DateTimeFormat } & Omit<ComponentProps<"time">, "dateTime" | "lang" | "children">) {
  return (
    <time dateTime={date} lang={languageAttributeInDocumentFor(format)} suppressHydrationWarning {...timeProps}>
      {formatDate(date, format)}
    </time>
  );
}
