import { beforeEach, expect, test, vi } from "vitest";

import { workerEnvState as env } from "#/test-utils/worker-env.ts";

import { CONTACT_EMAIL_ADDRESS_BINDING, SEND_EMAIL_BINDING } from "./bindings.ts";
import { SENDER, deliverMessage } from "./mail.ts";

import type { WorkerEnv } from "cloudflare:workers";

vi.mock("./env.ts", async () => (await import("#/test-utils/worker-env.ts")).workerEnvMock());

const DESTINATION_EMAIL_ADDRESS = "inbox@example.com";

const send = vi.fn<NonNullable<WorkerEnv["SEND_EMAIL"]>["send"]>();

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ messageId: "1" });
  env.current = { [SEND_EMAIL_BINDING]: { send }, [CONTACT_EMAIL_ADDRESS_BINDING]: DESTINATION_EMAIL_ADDRESS };
  vi.spyOn(console, "error").mockReturnValue();
});

const MESSAGE = {
  replyTo: "sender@example.com",
  subject: "Message from sender@example.com",
  text: "Hello.",
};
const rejectWith = (code: string) => {
  send.mockRejectedValue(Object.assign(new Error(code), { code }));
};

test("a message is addressed to the configured destination email address, with its sender as the reply-to address", async () => {
  await expect(deliverMessage(MESSAGE)).resolves.toBe("sent");
  expect(send).toHaveBeenCalledWith({
    from: SENDER,
    to: DESTINATION_EMAIL_ADDRESS,
    replyTo: MESSAGE.replyTo,
    subject: MESSAGE.subject,
    text: MESSAGE.text,
  });
});

test("a missing binding produces `unavailable` and logs the `contact_binding_missing` event, without sending a message", async () => {
  env.current = { [SEND_EMAIL_BINDING]: { send } };

  await expect(deliverMessage(MESSAGE)).resolves.toBe("unavailable");
  expect(send).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ event: "contact_binding_missing", binding: CONTACT_EMAIL_ADDRESS_BINDING }),
  );
});

test.each([
  ["E_RATE_LIMIT_EXCEEDED", "throttled"],
  ["E_DAILY_LIMIT_EXCEEDED", "exhausted"],
  ["E_SENDER_NOT_VERIFIED", "unavailable"],
  ["E_RECIPIENT_NOT_ALLOWED", "unavailable"],
  ["E_DELIVERY_FAILED", "unavailable"],
])("a rejection with the code `%s` produces `%s`", async (code, delivery) => {
  rejectWith(code);
  await expect(deliverMessage(MESSAGE)).resolves.toBe(delivery);
});

test("a rejection without a code produces `unavailable` and logs its code as `unknown`", async () => {
  send.mockRejectedValue("nope");

  await expect(deliverMessage(MESSAGE)).resolves.toBe("unavailable");
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ code: "unknown" }));
});

test("a rejection logs the sender, recipient, and code", async () => {
  rejectWith("E_RECIPIENT_NOT_ALLOWED");
  await deliverMessage(MESSAGE);

  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ from: SENDER.email, to: DESTINATION_EMAIL_ADDRESS, code: "E_RECIPIENT_NOT_ALLOWED" }),
  );
});

test("the message body is never logged", async () => {
  rejectWith("E_DELIVERY_FAILED");
  await deliverMessage(MESSAGE);

  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(MESSAGE.text);
});
