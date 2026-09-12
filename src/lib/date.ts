const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows to a calendar date in `YYYY-MM-DD` ISO-8601 form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);

  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().startsWith(value);
}

export function formatDate(isoString: string, format: Intl.DateTimeFormat): string {
  const timestamp = Date.parse(isoString);
  return Number.isNaN(timestamp) ? isoString : format.format(timestamp);
}

export const byNewestDate = (a: string | undefined, b: string | undefined) => (b ?? "").localeCompare(a ?? "");
