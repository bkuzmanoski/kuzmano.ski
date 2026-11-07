import { beforeEach, expect, test, vi } from "vitest";

import { workerEnvState as env } from "#/test-utils/worker-env.ts";

import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { readContactEmailAddress } from "./contact-email-address.ts";

vi.mock("./env.ts", async () => (await import("#/test-utils/worker-env.ts")).workerEnvMock());

const EMAIL_ADDRESS = "inbox@example.com";

beforeEach(() => {
  env.current = { [CONTACT_EMAIL_ADDRESS_BINDING]: EMAIL_ADDRESS };
  vi.spyOn(console, "error").mockReturnValue();
});

test("`readContactEmailAddress` returns the configured email address", async () => {
  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
  expect(console.error).not.toHaveBeenCalled();
});

test("`readContactEmailAddress` returns `null` and logs the `contact_binding_missing` event when the secret is missing", async () => {
  env.current = {};

  await expect(readContactEmailAddress()).resolves.toBeNull();
  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ event: "contact_binding_missing", binding: CONTACT_EMAIL_ADDRESS_BINDING }),
  );
});
