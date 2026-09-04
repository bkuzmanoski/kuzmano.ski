import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { CONTACT_EMAIL_ADDRESS_BINDING } from "./bindings.ts";
import { contactEmailAddress } from "./contact-email-address.ts";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env.ts", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const ADDRESS = "inbox@example.com";

beforeEach(() => {
  env.fails = false;
  env.current = { [CONTACT_EMAIL_ADDRESS_BINDING]: ADDRESS };
  vi.spyOn(console, "error").mockReturnValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("the configured email address is published", async () => {
  await expect(contactEmailAddress()).resolves.toBe(ADDRESS);
  expect(console.error).not.toHaveBeenCalled();
});

test.each([
  ["the secret is missing", () => (env.current = {})],
  ["the secret is empty", () => (env.current = { [CONTACT_EMAIL_ADDRESS_BINDING]: "" })],
  ["the environment is unreachable", () => (env.fails = true)],
])("an email address is not published, and the missing binding is logged, when %s", async (_label, arrange) => {
  arrange();

  await expect(contactEmailAddress()).resolves.toBeNull();
  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ event: "contact_binding_missing", binding: CONTACT_EMAIL_ADDRESS_BINDING }),
  );
});
