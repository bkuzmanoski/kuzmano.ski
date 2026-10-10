export interface DateFormat {
  locale: string;
  options: Intl.DateTimeFormatOptions & { timeZone: "UTC" };
}

/** A formatter for a `DateFormat`'s options, in `locale`, or in the format's own locale by default. */
export const dateFormatterOf = (format: DateFormat, locale = format.locale): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(locale, format.options);

/**
 * Writes an ISO 8601 calendar date (`YYYY-MM-DD` or `YYYY-MM`) in `format`. Returns `isoString`
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

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function calendarDateIn(timeZone: string, instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// The offset from UTC that `timeZone` observes at `instant`, as `Z` or `±hh:mm`.
function utcOffsetIn(timeZone: string, instant: number): string {
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find(({ type }) => type === "timeZoneName")?.value;
  const offset = offsetName?.slice("GMT".length) ?? "";

  return offset === "" || offset === "+00:00" ? "Z" : offset; // `longOffset` names a zero offset "GMT" or "GMT+00:00".
}

const offsetMilliseconds = (offset: string) =>
  offset === "Z"
    ? 0
    : (offset.startsWith("-") ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6))) * 60_000;

/** The RFC 3339 timestamp of midnight at the start of a `YYYY-MM-DD` date in `timeZone`. */
export function midnightTimestampIn(timeZone: string, date: string): string {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);

  // A daylight saving transition between midnight UTC and local midnight changes the offset,
  // so the offset is read again at the local midnight the first reading implies.
  const offset = utcOffsetIn(timeZone, utcMidnight - offsetMilliseconds(utcOffsetIn(timeZone, utcMidnight)));

  return `${date}T00:00:00${offset}`;
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
