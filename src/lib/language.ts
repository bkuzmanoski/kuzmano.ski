/**
 * The `lang` attribute for text formatted by `format`, or `undefined` when its locale is in
 * `documentLanguage`, so only text a screen reader would read in another language is marked.
 *
 * The locale is read from the formatter rather than from the one it was requested in, because
 * `Intl` falls back to a supported locale when it does not support the requested one.
 */
export function languageAttributeFor(
  format: Intl.DateTimeFormat | Intl.NumberFormat,
  documentLanguage: string,
): string | undefined {
  const { locale } = format.resolvedOptions();
  return new Intl.Locale(locale).language === new Intl.Locale(documentLanguage).language ? undefined : locale;
}
