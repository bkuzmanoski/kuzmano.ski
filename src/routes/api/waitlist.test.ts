import { beforeEach, expect, test, vi } from "vitest";

import { API } from "#/api.ts";
import { WAITLIST_RATELIMIT_BINDING } from "#/server/bindings.ts";
import type { MembershipResult } from "#/server/waitlist.ts";

import { Route } from "./waitlist.ts";

const recordMembership = vi.hoisted(() => vi.fn<() => Promise<MembershipResult>>());
const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("#/server/waitlist.ts", () => ({ recordMembership }));
vi.mock("#/server/rate-limit.ts", () => ({ isWithinRateLimit }));

beforeEach(() => {
  recordMembership.mockReset();
  recordMembership.mockResolvedValue("recorded");
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const ORIGIN = "https://example.com";
const URL = `${ORIGIN}${API.waitlist}`;
const VALID_SUBMISSION = {
  emailAddress: "user@example.com",
  list: "List",
  source: "/collection/entry",
};

// Use the exported route handler to exercise the endpoint as it is served.
// This route exports a handler record rather than a handler factory.
const { POST } = Route.options.server!.handlers as unknown as {
  POST: (context: { request: Request }) => Promise<Response>;
};

const post = (body: unknown, { origin = ORIGIN, headers = {} }: { origin?: string; headers?: HeadersInit } = {}) =>
  POST({
    request: new Request(URL, {
      method: "POST",
      headers: { origin, "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

test("a well-formed submission is recorded, with the list and the entry it came from", async () => {
  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(204);
  expect(recordMembership).toHaveBeenCalledWith({
    emailAddress: VALID_SUBMISSION.emailAddress,
    list: VALID_SUBMISSION.list,
    source: VALID_SUBMISSION.source,
  });
});

test("a cross-origin request is refused before anything is read", async () => {
  const response = await post(VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(isWithinRateLimit).not.toHaveBeenCalled();
  expect(recordMembership).not.toHaveBeenCalled();
});

test("submissions are counted against the waitlist's own rate limit", async () => {
  await post(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.1" } });
  expect(isWithinRateLimit).toHaveBeenCalledWith(WAITLIST_RATELIMIT_BINDING, "203.0.113.1");
});

test("a malformed submission is refused, and a membership is not recorded", async () => {
  expect((await post({ ...VALID_SUBMISSION, source: "https://elsewhere.example" })).status).toBe(400);
  expect(recordMembership).not.toHaveBeenCalled();
});

test("a submission rejected by the schema returns its errors", async () => {
  const response = await post({ ...VALID_SUBMISSION, emailAddress: "reader@" });
  const body = (await response.json()) as { errors: Record<string, string> };

  expect(response.status).toBe(400);
  expect(typeof body.errors.emailAddress).toBe("string");
  expect(recordMembership).not.toHaveBeenCalled();
});

test.each([
  ["throttled", 429],
  ["unavailable", 502],
] as const)("a %s result responds with a %i status code", async (result, status) => {
  recordMembership.mockResolvedValue(result);
  expect((await post(VALID_SUBMISSION)).status).toBe(status);
});
