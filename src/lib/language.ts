/**
 * Returns the `lang` attribute for text formatted by `format`, or `undefined` when its resolved locale matches
 * `documentLanguage`, so screen readers only switch languages when needed.
 *
 * Reads the formatter's resolved locale because `Intl` falls back when the requested locale is unsupported.
 */
export function languageAttributeFor(
  format: Intl.DateTimeFormat | Intl.NumberFormat,
  documentLanguage: string,
): string | undefined {
  const { locale } = format.resolvedOptions();
  return new Intl.Locale(locale).language === new Intl.Locale(documentLanguage).language ? undefined : locale;
}
