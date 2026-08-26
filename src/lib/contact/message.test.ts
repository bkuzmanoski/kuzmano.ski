import { describe, expect, test } from "vitest";

import { MESSAGE_MAX_LENGTH, MIN_COMPOSE_DURATION_MS, parseSubmission } from "./message";

const VALID = {
  from: "test@example.com",
  message: "Hello.",
  website: "",
  elapsedTimeMs: MIN_COMPOSE_DURATION_MS,
};

describe("parseSubmission", () => {
  test("accepts a well-formed submission, trimming the fields", () => {
    expect(parseSubmission({ ...VALID, from: "  test@example.com  ", message: " Hello. " })).toEqual({
      ok: true,
      fields: { from: "test@example.com", message: "Hello." },
    });
  });

  test.each([
    ["a missing field", { ...VALID, from: undefined }],
    ["a field of the wrong type", { ...VALID, message: 42 }],
    ["a non-numeric elapsed time", { ...VALID, elapsedTimeMs: "3000" }],
    ["a field longer than the endpoint will read", { ...VALID, message: "a".repeat(MESSAGE_MAX_LENGTH + 1) }],
  ])("reports %s as malformed", (_label, submission) => {
    expect(parseSubmission(submission)).toEqual({ ok: false, reason: "malformed" });
  });

  test("rejects a submission that filled in the website field", () => {
    expect(parseSubmission({ ...VALID, website: "https://example.com" })).toEqual({ ok: false, reason: "rejected" });
  });

  test("rejects a submission that arrived faster than it could have been typed", () => {
    expect(parseSubmission({ ...VALID, elapsedTimeMs: MIN_COMPOSE_DURATION_MS - 1 })).toEqual({
      ok: false,
      reason: "rejected",
    });
    expect(parseSubmission({ ...VALID, elapsedTimeMs: Number.NaN })).toEqual({ ok: false, reason: "rejected" });
  });

  test("applies the same rules the form does, and reports which one failed", () => {
    expect(parseSubmission({ ...VALID, from: "nope" })).toMatchObject({
      ok: false,
      reason: "invalid",
      errors: { from: expect.stringContaining("email address") as string },
    });
    expect(parseSubmission({ ...VALID, message: "   " })).toMatchObject({
      ok: false,
      reason: "invalid",
      errors: { message: expect.any(String) as string },
    });
  });
});
