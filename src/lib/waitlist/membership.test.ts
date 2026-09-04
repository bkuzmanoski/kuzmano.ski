import { expect, test } from "vitest";

import { MAX_EMAIL_ADDRESS_LENGTH } from "../forms/validation.ts";

import { LIST_MAX_LENGTH, parseSubmission } from "./membership.ts";

const VALID_SUBMISSION = {
  emailAddress: "user@example.com",
  list: "List",
  source: "/collection/entry",
};

test("a complete submission is parsed into the membership to record", () => {
  expect(parseSubmission(VALID_SUBMISSION)).toEqual({
    ok: true,
    value: { emailAddress: "user@example.com", list: "List", source: "/collection/entry" },
  });
});

test("surrounding whitespace is trimmed from every field", () => {
  expect(parseSubmission({ ...VALID_SUBMISSION, emailAddress: "  user@example.com  ", list: " List " })).toEqual({
    ok: true,
    value: { emailAddress: "user@example.com", list: "List", source: "/collection/entry" },
  });
});

test.each([
  ["a missing email address", { emailAddress: undefined }],
  ["a missing list", { list: undefined }],
  ["an empty list", { list: "   " }],
  ["a missing source", { source: undefined }],
  ["a field of the wrong type", { list: 42 }],
  [
    "an email address that exceeds the maximum length",
    { emailAddress: `${"a".repeat(MAX_EMAIL_ADDRESS_LENGTH)}@example.com` },
  ],
  ["a list that exceeds the maximum length", { list: "a".repeat(LIST_MAX_LENGTH + 1) }],
])("%s is malformed", (_label, overrides) => {
  expect(parseSubmission({ ...VALID_SUBMISSION, ...overrides })).toEqual({ ok: false, reason: "malformed" });
});

test.each([
  ["an absolute URL", "https://example.com/collection/entry"],
  ["a protocol-relative URL", "//example.com/collection/entry"],
  ["a relative path", "collection/entry"],
])("a source that is %s is malformed", (_label, source) => {
  expect(parseSubmission({ ...VALID_SUBMISSION, source })).toEqual({ ok: false, reason: "malformed" });
});

test("an invalid email address is rejected with its field error", () => {
  const parsed = parseSubmission({ ...VALID_SUBMISSION, emailAddress: "user@" });

  expect(parsed).toMatchObject({ ok: false, reason: "invalid" });
  expect(parsed).toHaveProperty("errors.emailAddress", expect.stringMatching(/email address/));
});
