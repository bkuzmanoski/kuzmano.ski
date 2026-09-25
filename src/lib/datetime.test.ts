import { describe, expect, test } from "vitest";

import { formatDate, formatPlaybackTime } from "./datetime.ts";

describe("formatDate", () => {
  const dayFormat = new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "long", // A long month name, since the abbreviations ICU writes for en-AU differ between ICU versions.
    day: "numeric",
    timeZone: "UTC",
  });
  const monthFormat = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "long", timeZone: "UTC" });

  test("writes a `YYYY-MM-DD` date in the format it is given", () => {
    expect(formatDate("2026-09-01", dayFormat)).toBe("1 September 2026");
  });

  test("writes a `YYYY-MM` month in the format it is given", () => {
    expect(formatDate("2026-09", monthFormat)).toBe("September 2026");
  });

  test("returns the input unchanged when it does not parse", () => {
    expect(formatDate("undated", dayFormat)).toBe("undated");
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
