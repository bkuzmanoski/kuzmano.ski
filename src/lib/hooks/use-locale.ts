import { useClientValue } from "./use-client-value.ts";

/**
 * The locale to format dates and numbers in.
 *
 * The server render and the hydration render both use `prerenderLocale`, so the hydrated
 * markup matches the prerendered markup. React re-renders with the browser's own locale
 * once hydration has finished.
 */
export function useLocale(prerenderLocale: string): string {
  return useClientValue(prerenderLocale, () => navigator.language || prerenderLocale);
}
