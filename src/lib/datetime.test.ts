import { describe, expect, test } from "vitest";

import { formatPlaybackTime } from "./datetime.ts";

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
