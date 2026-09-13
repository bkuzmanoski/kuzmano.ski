import { describe, expect, test } from "vitest";

import { trimmedStringField } from "./submission.ts";

describe("trimmedStringField", () => {
  test("returns the value with surrounding whitespace trimmed", () => {
    expect(trimmedStringField("  value  ", 9)).toBe("value");
  });

  test.each([
    ["a missing field", undefined],
    ["a field that is not a string", 42],
  ])("returns `null` for %s", (_label, value) => {
    expect(trimmedStringField(value, 9)).toBeNull();
  });

  test("returns `null` for a value that exceeds the limit before trimming", () => {
    expect(trimmedStringField("  value   ", 9)).toBeNull(); // Surrounding whitespace counts toward the limit, so trimming cannot shorten an over-long value into an accepted one.
  });
});
