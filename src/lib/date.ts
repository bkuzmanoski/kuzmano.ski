export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function formatDate(isoString: string, format: Intl.DateTimeFormat): string {
  const time = Date.parse(isoString);
  return Number.isNaN(time) ? isoString : format.format(time);
}
