import { expect, test } from "vitest";

import { alertFor } from "./prompt.ts";

const FAILURE = { kind: "failed", message: "The message couldn’t be sent.", suggestDirectEmail: true } as const;

test("the alert message for a failure with `suggestDirectEmail` includes the email address", () => {
  expect(alertFor(FAILURE, "inbox@example.com").message).toBe(
    "The message couldn’t be sent. You can write directly to inbox@example.com instead.",
  );
});

test("the alert message for a failure with `suggestDirectEmail` omits the email address when it is `null`", () => {
  expect(alertFor(FAILURE, null).message).toBe(FAILURE.message);
});

test("the alert message for a failure without `suggestDirectEmail` omits the email address", () => {
  expect(alertFor({ kind: "failed", message: FAILURE.message }, "inbox@example.com").message).toBe(FAILURE.message);
});
