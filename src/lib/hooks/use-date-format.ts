import { useMemo, useSyncExternalStore } from "react";

import { noSubscribe } from "#/lib/emitter";

export interface DateFormat {
  locale: string; // The locale the prerendered markup is written in.
  options: Intl.DateTimeFormatOptions;
}

/**
 * A date formatter in the reader's own locale.
 *
 * The server pass and the hydration pass both use the locale the server prerendered.
 * React re-renders with browser's locale own once hydration has finished.
 */
export function useDateFormat({ locale, options }: DateFormat): Intl.DateTimeFormat {
  const readerLocale = useSyncExternalStore(
    noSubscribe,
    () => navigator.language || locale,
    () => locale,
  );
  return useMemo(() => new Intl.DateTimeFormat(readerLocale, options), [readerLocale, options]);
}
