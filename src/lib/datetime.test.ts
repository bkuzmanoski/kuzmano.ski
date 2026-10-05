import { describe, expect, test } from "vitest";

import { calendarDateIn, formatDate, formatPlaybackTime, midnightTimestampIn } from "./datetime.ts";

describe("formatDate", () => {
  const dayFormat = new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "long", // A long month name, since the abbreviations ICU writes for en-AU differ between ICU versions.
    day: "numeric",
    timeZone: "UTC",
  });
  const monthFormat = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "long", timeZone: "UTC" });

  test("formats a `YYYY-MM-DD` date with the format it is given", () => {
    expect(formatDate("2026-09-01", dayFormat)).toBe("1 September 2026");
  });

  test("formats a `YYYY-MM` month with the format it is given", () => {
    expect(formatDate("2026-09", monthFormat)).toBe("September 2026");
  });

  test("returns the input unchanged when it does not parse", () => {
    expect(formatDate("undated", dayFormat)).toBe("undated");
  });
});

describe("calendarDateIn", () => {
  test("returns the calendar date of an instant in the time zone it is given", () => {
    const instant = new Date("2026-10-03T22:00:00Z");

    expect(calendarDateIn("UTC", instant)).toBe("2026-10-03");
    expect(calendarDateIn("Australia/Sydney", instant)).toBe("2026-10-04");
  });
});

describe("midnightTimestampIn", () => {
  test("returns a timestamp with the `Z` offset in UTC", () => {
    expect(midnightTimestampIn("UTC", "2026-07-19")).toBe("2026-07-19T00:00:00Z");
  });

  test("returns the offset the time zone observes at midnight on the date", () => {
    expect(midnightTimestampIn("Australia/Sydney", "2026-07-19")).toBe("2026-07-19T00:00:00+10:00");
    expect(midnightTimestampIn("Australia/Sydney", "2026-01-15")).toBe("2026-01-15T00:00:00+11:00");
    expect(midnightTimestampIn("America/New_York", "2026-07-19")).toBe("2026-07-19T00:00:00-04:00");
  });

  test("returns the offset in force at midnight on a date whose daylight saving transition is later that day", () => {
    expect(midnightTimestampIn("Australia/Sydney", "2026-10-04")).toBe("2026-10-04T00:00:00+10:00");
    expect(midnightTimestampIn("Australia/Sydney", "2027-04-04")).toBe("2027-04-04T00:00:00+11:00");
  });
});

describe("formatPlaybackTime", () => {
  test("formats a time under an hour as minutes and zero-padded seconds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(7.9)).toBe("0:07");
    expect(formatPlaybackTime(754)).toBe("12:34");
  });

  test("formats a time of an hour or more as hours, zero-padded minutes, and zero-padded seconds", () => {
    expect(formatPlaybackTime(3600)).toBe("1:00:00");
    expect(formatPlaybackTime(3845)).toBe("1:04:05");
  });

  test("formats a negative or non-finite time as `0:00`", () => {
    expect(formatPlaybackTime(-1)).toBe("0:00");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
    expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
