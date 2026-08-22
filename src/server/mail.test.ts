import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SITE_NAME } from "#/config/site";

import { CONTACT_EMAIL_ADDRESS_BINDING, SEND_EMAIL_BINDING } from "./bindings";
import { deliver } from "./mail";

import type { WorkerEnv } from "cloudflare:workers";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const MESSAGE = {
  replyTo: "sender@example.com",
  subject: "Message from sender@example.com",
  text: "Hello.",
};
const DESTINATION = "inbox@example.com";
const SENDER = { name: SITE_NAME, email: "no-reply@kuzmano.ski" };

const send = vi.fn<NonNullable<WorkerEnv["SEND_EMAIL"]>["send"]>();

const rejectWith = (code: string) => {
  send.mockRejectedValue(Object.assign(new Error(code), { code }));
};

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ messageId: "1" });
  env.fails = false;
  env.current = { [SEND_EMAIL_BINDING]: { send }, [CONTACT_EMAIL_ADDRESS_BINDING]: DESTINATION };
  vi.spyOn(console, "error").mockReturnValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("a message is addressed to the configured destination email address, replying to its sender", async () => {
  await expect(deliver(MESSAGE)).resolves.toBe("sent");
  expect(send).toHaveBeenCalledWith({
    from: SENDER,
    to: DESTINATION,
    replyTo: MESSAGE.replyTo,
    subject: MESSAGE.subject,
    text: MESSAGE.text,
  });
});

describe("expected bindings", () => {
  test.each([
    ["send_mail binding", { [CONTACT_EMAIL_ADDRESS_BINDING]: DESTINATION }, SEND_EMAIL_BINDING],
    ["destination secret", { [SEND_EMAIL_BINDING]: { send } }, CONTACT_EMAIL_ADDRESS_BINDING],
  ])("a missing %s is reported", async (_label, partial, binding) => {
    env.current = partial;

    await expect(deliver(MESSAGE)).resolves.toBe("unavailable");
    expect(send).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ binding }));
  });
});

test.each([
  ["E_RATE_LIMIT_EXCEEDED", "throttled"],
  ["E_DAILY_LIMIT_EXCEEDED", "exhausted"],
  ["E_SENDER_NOT_VERIFIED", "unavailable"],
  ["E_RECIPIENT_NOT_ALLOWED", "unavailable"],
  ["E_DELIVERY_FAILED", "unavailable"],
])('"%s" maps to "%s"', async (code, delivery) => {
  rejectWith(code);
  await expect(deliver(MESSAGE)).resolves.toBe(delivery);
});

test("a rejection without a code is still reported and logged", async () => {
  send.mockRejectedValue("nope");

  await expect(deliver(MESSAGE)).resolves.toBe("unavailable");
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ code: "unknown" }));
});

test("a failed send logs the refused sender and recipient", async () => {
  rejectWith("E_RECIPIENT_NOT_ALLOWED");
  await deliver(MESSAGE);

  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ from: SENDER.email, to: DESTINATION, code: "E_RECIPIENT_NOT_ALLOWED" }),
  );
});

test("the message body is never logged", async () => {
  rejectWith("E_DELIVERY_FAILED");
  await deliver(MESSAGE);

  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(MESSAGE.text);
});

test("an environment that cannot be resolved is reported rather than thrown", async () => {
  env.fails = true;

  await expect(deliver(MESSAGE)).resolves.toBe("unavailable");
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ event: "contact_binding_missing" }));
});
