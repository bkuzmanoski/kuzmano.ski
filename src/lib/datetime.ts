export interface DateFormat {
  locale: string;
  options: Intl.DateTimeFormatOptions & { timeZone: "UTC" };
}

/** A formatter for a `DateFormat`'s options, in `locale`, or in the format's own locale by default. */
export const dateFormatterOf = (format: DateFormat, locale = format.locale): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(locale, format.options);

/**
 * Writes an ISO 8601 calendar date, `YYYY-MM-DD` or `YYYY-MM`, in `format`. Returns `isoString`
 * unchanged when it does not parse.
 */
export function formatDate(isoString: string, format: Intl.DateTimeFormat): string {
  const timestamp = Date.parse(isoString);
  return Number.isNaN(timestamp) ? isoString : format.format(timestamp);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows to a calendar date in `YYYY-MM-DD` ISO-8601 form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);

  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().startsWith(value);
}

export const byNewestDate = (a: string | undefined, b: string | undefined) => (b ?? "").localeCompare(a ?? "");

/** Formats a media playback position as `m:ss` or `h:mm:ss`. */
export function formatPlaybackTime(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secondsPart = String(totalSeconds % 60).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secondsPart}` : `${minutes}:${secondsPart}`;
}
