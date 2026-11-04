import { dateFormatterOf } from "../datetime.ts";

import { useLocale } from "./use-locale.ts";

import type { DateFormat } from "../datetime.ts";

/** A formatter for a `DateFormat`'s options, in the locale `useLocale` returns for its prerender locale. */
export function useDateFormat(format: DateFormat): Intl.DateTimeFormat {
  return dateFormatterOf(format, useLocale(format.locale));
}
