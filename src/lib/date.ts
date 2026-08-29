const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows to a calendar date in `YYYY-MM-DD` ISO-8601 form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return false;
  }

  const time = Date.parse(value);

  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

export function formatDate(isoString: string, format: Intl.DateTimeFormat): string {
  const time = Date.parse(isoString);
  return Number.isNaN(time) ? isoString : format.format(time);
}

export const byNewestDate = (a: string | undefined, b: string | undefined) => (b ?? "").localeCompare(a ?? "");
