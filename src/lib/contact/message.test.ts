import { expect, test } from "vitest";

import { MAX_ADDRESS_LENGTH } from "#/lib/forms/validation";

import { MESSAGE_MAX_LENGTH, parseSubmission } from "./message";

const VALID_SUBMISSION = {
  from: "test@example.com",
  message: "Hello.",
};

test("a complete submission is parsed into the fields to send", () => {
  expect(parseSubmission(VALID_SUBMISSION)).toEqual({
    ok: true,
    value: { from: "test@example.com", message: "Hello." },
  });
});

test("surrounding whitespace is trimmed from every field", () => {
  expect(parseSubmission({ ...VALID_SUBMISSION, from: "  test@example.com  ", message: " Hello. " })).toEqual({
    ok: true,
    value: { from: "test@example.com", message: "Hello." },
  });
});

test("a length limit is measured before trimming, so padding counts towards it", () => {
  const padding = " ".repeat(MESSAGE_MAX_LENGTH);
  expect(parseSubmission({ ...VALID_SUBMISSION, message: `${padding}Hello.` })).toEqual({
    ok: false,
    reason: "malformed",
  });
});

test.each([
  ["a missing email address", { from: undefined }],
  ["a missing message", { message: undefined }],
  ["a field of the wrong type", { message: 42 }],
  ["an email address longer than the limit", { from: `${"a".repeat(MAX_ADDRESS_LENGTH)}@example.com` }],
  ["a message longer than the limit", { message: "a".repeat(MESSAGE_MAX_LENGTH + 1) }],
])("%s is malformed", (_label, overrides) => {
  expect(parseSubmission({ ...VALID_SUBMISSION, ...overrides })).toEqual({ ok: false, reason: "malformed" });
});

test("invalid fields produce their field errors", () => {
  expect(parseSubmission({ ...VALID_SUBMISSION, from: "nope" })).toMatchObject({
    ok: false,
    reason: "invalid",
    errors: { from: expect.stringContaining("email address") as string },
  });
  expect(parseSubmission({ ...VALID_SUBMISSION, message: "   " })).toMatchObject({
    ok: false,
    reason: "invalid",
    errors: { message: expect.any(String) as string },
  });
});
