import { beforeEach, expect, test, vi } from "vitest";

import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "./bindings.ts";
import { isWithinRateLimit } from "./rate-limit.ts";

import type { WorkerEnv } from "cloudflare:workers";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env.ts", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const rateLimit = vi.fn<NonNullable<WorkerEnv["SEND_EMAIL_RATELIMIT"]>["limit"]>();

beforeEach(() => {
  rateLimit.mockReset();
  env.fails = false;
  env.current = { [SEND_EMAIL_RATELIMIT_BINDING]: { limit: rateLimit } };
});

test("the budget is counted against the sender's key", async () => {
  rateLimit.mockResolvedValue({ success: true });

  await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
  expect(rateLimit).toHaveBeenCalledWith({ key: "203.0.113.1" });
});

test("a key over its budget is refused", async () => {
  rateLimit.mockResolvedValue({ success: false });
  await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(false);
});

test("each binding's rate limit is counted separately", async () => {
  rateLimit.mockResolvedValue({ success: false });

  await expect(isWithinRateLimit(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
  expect(rateLimit).not.toHaveBeenCalled();
});

test.each([
  ["there is no binding", () => (env.current = {})],
  ["the environment is unreachable", () => (env.fails = true)],
  ["the binding itself throws", () => rateLimit.mockRejectedValue(new Error("Unavailable."))],
])("a request passes when %s", async (_label, arrange) => {
  arrange();
  await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
});
