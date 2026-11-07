import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { WAITLIST_RATELIMIT_BINDING } from "#/server/bindings.ts";
import type { MembershipResult } from "#/server/waitlist.ts";
import { jsonPostRequest, requestHandlersOf } from "#/test-utils/requests.ts";

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

const ENDPOINT_URL = `https://example.com${API_ROUTES.waitlist}`;
const VALID_SUBMISSION = {
  emailAddress: "user@example.com",
  list: "List",
  source: "/collection/entry",
};

const { POST } = requestHandlersOf(Route);

const post = (body: unknown, options?: Parameters<typeof jsonPostRequest>[2]) =>
  POST({ request: jsonPostRequest(ENDPOINT_URL, body, options) });

test("the endpoint records a well-formed submission, with its email address, list, and source route", async () => {
  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(204);
  expect(recordMembership).toHaveBeenCalledWith({
    emailAddress: VALID_SUBMISSION.emailAddress,
    list: VALID_SUBMISSION.list,
    source: VALID_SUBMISSION.source,
  });
});

test("the endpoint refuses a cross-origin request, and does not record a membership", async () => {
  const response = await post(VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(recordMembership).not.toHaveBeenCalled();
});

test("the endpoint counts submissions against the waitlist's own rate limit", async () => {
  await post(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.1" } });
  expect(isWithinRateLimit).toHaveBeenCalledWith(WAITLIST_RATELIMIT_BINDING, "203.0.113.1");
});

test("the endpoint refuses a malformed submission, and does not record a membership", async () => {
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
] as const)("a result of `%s` responds with a %i status code", async (result, status) => {
  recordMembership.mockResolvedValue(result);
  expect((await post(VALID_SUBMISSION)).status).toBe(status);
});
