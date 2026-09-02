import { beforeEach, expect, test, vi } from "vitest";

import { SEND_EMAIL_RATELIMIT_BINDING } from "./bindings";
import { readSubmission, refusalFor } from "./endpoint";
import { MAX_BODY_LENGTH } from "./request";

import type { RateLimitBindingName } from "./bindings";

const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("./rate-limit", () => ({ isWithinRateLimit }));

beforeEach(() => {
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const ORIGIN = "https://example.com";
const URL = `${ORIGIN}/api/endpoint`;
const VALID_SUBMISSION = { field: "value" };

const read = (
  body: unknown,
  {
    origin = ORIGIN,
    headers = {},
    rateLimit = SEND_EMAIL_RATELIMIT_BINDING,
  }: { origin?: string; headers?: HeadersInit; rateLimit?: RateLimitBindingName | null } = {},
) =>
  readSubmission(
    new Request(URL, {
      method: "POST",
      headers: { origin, "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    rateLimit ?? undefined,
  );

const refusalStatus = (result: Awaited<ReturnType<typeof read>>) => (result.ok ? undefined : result.response.status);

test("a well-formed body is read as the submission it contains", async () => {
  await expect(read(VALID_SUBMISSION)).resolves.toEqual({ ok: true, fields: VALID_SUBMISSION });
});

test("a cross-origin request is refused before anything is read", async () => {
  expect(refusalStatus(await read(VALID_SUBMISSION, { origin: "https://elsewhere.example" }))).toBe(403);
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test.each([
  ["a declared content length that exceeds the limit", "{}", { "content-length": String(MAX_BODY_LENGTH + 1) }],
  ["a body that exceeds the maximum length", `{"pad":"${"a".repeat(MAX_BODY_LENGTH)}"}`, {}],
])("%s is refused", async (_label, body, headers) => {
  expect(refusalStatus(await read(body, { headers }))).toBe(413);
});

test("a request that exceeds the rate limit is refused", async () => {
  isWithinRateLimit.mockResolvedValue(false);
  expect(refusalStatus(await read(VALID_SUBMISSION))).toBe(429);
});

test("the rate limit is applied before the body is read", async () => {
  isWithinRateLimit.mockResolvedValue(false);
  expect(refusalStatus(await read("not json at all"))).toBe(429);
});

test("rate limiting uses the sender's IP address as its key", async () => {
  await read(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.7" } });
  expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.7");
});

test("a request with no IP address shares one bucket rather than escaping the limit", async () => {
  await read(VALID_SUBMISSION);
  expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "unknown");
});

test("an endpoint with no rate limit of its own reads the body without counting the sender", async () => {
  await expect(read(VALID_SUBMISSION, { rateLimit: null })).resolves.toEqual({
    ok: true,
    fields: VALID_SUBMISSION,
  });
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test.each([
  ["invalid JSON", "{"],
  ["a JSON array instead of an object", "[]"],
])("%s is rejected", async (_label, body) => {
  expect(refusalStatus(await read(body))).toBe(400);
});

test("a malformed submission is refused without a reason", async () => {
  const response = refusalFor({ ok: false, reason: "malformed" });

  expect(response.status).toBe(400);
  expect(response.headers.get("content-type")).toBeNull();
  await expect(response.text()).resolves.toBe("");
});

test("a submission rejected by the schema returns its errors", async () => {
  const response = refusalFor<{ from: string }>({
    ok: false,
    reason: "invalid",
    errors: { from: "Enter your email address." },
  });

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ errors: { from: "Enter your email address." } });
});
