import { useClientValue } from "../hooks/use-client-value.ts";

/**
 * Returns the locale for formatting dates and numbers.
 *
 * Uses `prerenderLocale` during SSR and hydration so markup matches, then re-renders with the browser's locale.
 */
export function useLocale(prerenderLocale: string): string {
  return useClientValue(prerenderLocale, () => navigator.language || prerenderLocale);
}
