import { useMemo } from "react";

import { useClientValue } from "./use-client-value.ts";

export interface DateFormat {
  locale: string; // The locale the prerendered markup is written in.
  options: Intl.DateTimeFormatOptions;
}

/**
 * A date formatter in the user's own locale.
 *
 * The server pass and the hydration pass both use the locale the server prerendered.
 * React re-renders with browser's own locale once hydration has finished.
 */
export function useDateFormat({ locale, options }: DateFormat): Intl.DateTimeFormat {
  const userLocale = useClientValue(locale, () => navigator.language || locale);
  return useMemo(() => new Intl.DateTimeFormat(userLocale, options), [userLocale, options]);
}
