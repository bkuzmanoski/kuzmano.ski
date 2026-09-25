import { useLocale } from "./use-locale.ts";

/** A formatter for numbers, in the locale `useLocale` returns for `prerenderLocale`. */
export function useNumberFormat(prerenderLocale: string): Intl.NumberFormat {
  const locale = useLocale(prerenderLocale);
  return new Intl.NumberFormat(locale);
}
