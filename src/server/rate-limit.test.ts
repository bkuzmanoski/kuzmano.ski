import { beforeEach, expect, test, vi } from "vitest";

import { SEND_EMAIL_RATELIMIT_BINDING } from "./bindings";
import { isWithinRateLimit } from "./rate-limit";

import type { WorkerEnv } from "cloudflare:workers";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const limit = vi.fn<NonNullable<WorkerEnv["SEND_EMAIL_RATELIMIT"]>["limit"]>();

beforeEach(() => {
  limit.mockReset();
  env.fails = false;
  env.current = { [SEND_EMAIL_RATELIMIT_BINDING]: { limit } };
});

test("the budget is counted against the sender's key", async () => {
  limit.mockResolvedValue({ success: true });

  await expect(isWithinRateLimit("203.0.113.1")).resolves.toBe(true);
  expect(limit).toHaveBeenCalledWith({ key: "203.0.113.1" });
});

test("a key over its budget is refused", async () => {
  limit.mockResolvedValue({ success: false });
  await expect(isWithinRateLimit("203.0.113.1")).resolves.toBe(false);
});

test.each([
  ["there is no binding", () => (env.current = {})],
  ["the environment is unreachable", () => (env.fails = true)],
  ["the binding itself throws", () => limit.mockRejectedValue(new Error("Unavailable."))],
])("a request passes when %s", async (_label, arrange) => {
  arrange();
  await expect(isWithinRateLimit("203.0.113.1")).resolves.toBe(true);
});
