import { beforeEach, expect, test, vi } from "vitest";

import { jsonPostRequest } from "#/test-utils/requests.ts";

import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "./bindings.ts";
import { readSubmission, refusalForGet, responseForRefusedSubmission } from "./endpoint.ts";
import { MAX_BODY_LENGTH } from "./request.ts";

import type { RateLimitBindingName } from "./bindings.ts";

const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("./rate-limit.ts", () => ({ isWithinRateLimit }));

beforeEach(() => {
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const URL = "https://example.com/api/endpoint";
const VALID_SUBMISSION = { field: "value" };

const get = ({
  headers = { "sec-fetch-site": "same-origin" },
  rateLimit = CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING,
}: { headers?: HeadersInit; rateLimit?: RateLimitBindingName | null } = {}) =>
  refusalForGet(new Request(URL, { headers }), rateLimit ?? undefined);
const read = (
  body: unknown,
  {
    rateLimit = SEND_EMAIL_RATELIMIT_BINDING,
    ...options
  }: Parameters<typeof jsonPostRequest>[2] & { rateLimit?: RateLimitBindingName | null } = {},
) => readSubmission(jsonPostRequest(URL, body, options), rateLimit ?? undefined);
const refusalStatus = (result: Awaited<ReturnType<typeof read>>) => (result.ok ? undefined : result.response.status);

test("`refusalForGet` returns `null` for a same-origin GET within the rate limit", async () => {
  await expect(get()).resolves.toBeNull();
});

test.each([
  ["from another site", { "sec-fetch-site": "cross-site" }],
  ["from the address bar or a bookmark", { "sec-fetch-site": "none" }],
  ["without a `Sec-Fetch-Site` header", {}],
])("a GET %s is refused before the rate limit is checked", async (_label, headers) => {
  expect((await get({ headers }))?.status).toBe(403);
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test("a GET that exceeds the rate limit is refused", async () => {
  isWithinRateLimit.mockResolvedValue(false);
  expect((await get())?.status).toBe(429);
});

test("a GET is counted against the rate limit it is given, keyed by the sender's IP address", async () => {
  await get({ headers: { "sec-fetch-site": "same-origin", "cf-connecting-ip": "203.0.113.7" } });
  expect(isWithinRateLimit).toHaveBeenCalledWith(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, "203.0.113.7");
});

test("`refusalForGet` returns `null` for a same-origin GET to an endpoint that has no rate limit of its own, without counting the sender", async () => {
  await expect(get({ rateLimit: null })).resolves.toBeNull();
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test("a well-formed body is parsed into the submitted fields", async () => {
  await expect(read(VALID_SUBMISSION)).resolves.toEqual({ ok: true, fields: VALID_SUBMISSION });
});

test("a cross-origin request is refused before its body is read or the rate limit is checked", async () => {
  const request = jsonPostRequest(URL, VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(refusalStatus(await readSubmission(request, SEND_EMAIL_RATELIMIT_BINDING))).toBe(403);
  expect(request.bodyUsed).toBe(false);
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test.each([
  [
    "a declared content length that exceeds the maximum length",
    "{}",
    { "content-length": String(MAX_BODY_LENGTH + 1) },
  ],
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

test("rate limiting uses the fallback key for a request without an IP address", async () => {
  // Requests without an IP address share one key rather than each escaping the limit.
  await read(VALID_SUBMISSION);
  expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "unknown");
});

test("an endpoint that has no rate limit of its own reads the body without counting the sender", async () => {
  await expect(read(VALID_SUBMISSION, { rateLimit: null })).resolves.toEqual({
    ok: true,
    fields: VALID_SUBMISSION,
  });
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test.each([
  ["a body that does not parse as JSON", "{"],
  ["a body that is a JSON array instead of an object", "[]"],
])("%s is refused", async (_label, body) => {
  expect(refusalStatus(await read(body))).toBe(400);
});

test("a malformed submission is refused with an empty body", async () => {
  const response = responseForRefusedSubmission({ ok: false, reason: "malformed" });

  expect(response.status).toBe(400);
  expect(response.headers.get("content-type")).toBeNull();
  await expect(response.text()).resolves.toBe("");
});

test("a submission rejected by the schema returns its errors", async () => {
  const response = responseForRefusedSubmission<{ from: string }>({
    ok: false,
    reason: "invalid",
    errors: { from: "Enter your email address." },
  });

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ errors: { from: "Enter your email address." } });
});
