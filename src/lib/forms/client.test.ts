import { describe, expect, test } from "vitest";

import { firstMessage, invalidResult } from "./client.ts";

interface Fields {
  from: string;
  message: string;
}

const FALLBACK = "The message couldn’t be sent.";

describe("invalidResult", () => {
  test("the field errors returned by the endpoint are preserved", () => {
    expect(invalidResult<Fields>({ errors: { from: "Enter your email address." } })).toEqual({
      status: "invalid",
      errors: { from: "Enter your email address." },
    });
  });

  test.each([
    ["a body that is not JSON", null],
    ["a body that is not a record", "nope"],
    ["a body with no errors", { other: true }],
    ["errors that are not a record", { errors: "nope" }],
  ])("%s produces an invalid result with no field errors", (_label, body) => {
    expect(invalidResult<Fields>(body)).toEqual({ status: "invalid", errors: {} });
  });
});

describe("firstMessage", () => {
  test("the message for the first field with an error is chosen", () => {
    const errors = { from: "Enter your email address.", message: "Write a message to send." };
    expect(firstMessage<Fields>(errors, FALLBACK)).toBe("Enter your email address.");
  });

  test("the fallback is used when there are no field errors", () => {
    expect(firstMessage<Fields>({}, FALLBACK)).toBe(FALLBACK);
  });
});
