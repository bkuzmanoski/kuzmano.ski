import { expect, test } from "vitest";

import { alertFor } from "./prompt";

const FAILURE = { kind: "failed", message: "The message couldn’t be sent.", suggestDirectEmail: true } as const;

test("a failure that offers a fallback names the email address", () => {
  expect(alertFor(FAILURE, "inbox@example.com").message).toBe(
    "The message couldn’t be sent. You can write directly to inbox@example.com instead.",
  );
});

test("a failure raised before the email address is read shows the message without it", () => {
  expect(alertFor(FAILURE, null).message).toBe(FAILURE.message);
});

test("a failure with no fallback leaves the email address out", () => {
  expect(alertFor({ kind: "failed", message: FAILURE.message }, "inbox@example.com").message).toBe(FAILURE.message);
});
