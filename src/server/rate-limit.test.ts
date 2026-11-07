import { beforeEach, describe, expect, test, vi } from "vitest";

import { workerEnvState as env } from "#/test-utils/worker-env.ts";

import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "./bindings.ts";
import { isWithinRateLimit } from "./rate-limit.ts";

import type { WorkerEnv } from "cloudflare:workers";

vi.mock("./env.ts", async () => (await import("#/test-utils/worker-env.ts")).workerEnvMock());

const rateLimit = vi.fn<NonNullable<WorkerEnv["SEND_EMAIL_RATELIMIT"]>["limit"]>();

beforeEach(() => {
  rateLimit.mockReset();
  env.current = { [SEND_EMAIL_RATELIMIT_BINDING]: { limit: rateLimit } };
});

describe("isWithinRateLimit", () => {
  test("counts the sender's key against the binding's budget", async () => {
    rateLimit.mockResolvedValue({ success: true });

    await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
    expect(rateLimit).toHaveBeenCalledWith({ key: "203.0.113.1" });
  });

  test("returns `false` for a key over its budget", async () => {
    rateLimit.mockResolvedValue({ success: false });
    await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(false);
  });

  test("counts each binding's rate limit separately", async () => {
    rateLimit.mockResolvedValue({ success: false });

    await expect(isWithinRateLimit(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  test.each([
    ["there is no binding", () => (env.current = {})],
    ["the environment is unreachable", () => (env.current = null)],
    ["the binding itself throws", () => rateLimit.mockRejectedValue(new Error("Unavailable."))],
  ])("returns `true` when %s", async (_label, arrange) => {
    arrange();
    await expect(isWithinRateLimit(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.1")).resolves.toBe(true);
  });
});
