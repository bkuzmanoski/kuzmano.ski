import { beforeEach, describe, expect, test, vi } from "vitest";

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

const ENDPOINT_URL = "https://example.com/api/endpoint";
const VALID_SUBMISSION = { field: "value" };

const get = ({
  headers = { "sec-fetch-site": "same-origin" },
  rateLimit = CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING,
}: { headers?: HeadersInit; rateLimit?: RateLimitBindingName | null } = {}) =>
  refusalForGet(new Request(ENDPOINT_URL, { headers }), rateLimit ?? undefined);
const read = (
  body: unknown,
  {
    rateLimit = SEND_EMAIL_RATELIMIT_BINDING,
    ...options
  }: Parameters<typeof jsonPostRequest>[2] & { rateLimit?: RateLimitBindingName | null } = {},
) => readSubmission(jsonPostRequest(ENDPOINT_URL, body, options), rateLimit ?? undefined);
const refusalStatus = (result: Awaited<ReturnType<typeof read>>) => (result.ok ? undefined : result.response.status);

describe("refusalForGet", () => {
  test("returns `null` for a same-origin GET within the rate limit", async () => {
    await expect(get()).resolves.toBeNull();
  });

  test.each([
    ["from another site", { "sec-fetch-site": "cross-site" }],
    ["from the address bar or a bookmark", { "sec-fetch-site": "none" }],
    ["without a `Sec-Fetch-Site` header", {}],
  ])("refuses a GET %s before it checks the rate limit", async (_label, headers) => {
    expect((await get({ headers }))?.status).toBe(403);
    expect(isWithinRateLimit).not.toHaveBeenCalled();
  });

  test("refuses a GET that exceeds the rate limit", async () => {
    isWithinRateLimit.mockResolvedValue(false);
    expect((await get())?.status).toBe(429);
  });

  test("counts a GET against the rate limit passed to it, keyed by the sender's IP address", async () => {
    await get({ headers: { "sec-fetch-site": "same-origin", "cf-connecting-ip": "203.0.113.7" } });
    expect(isWithinRateLimit).toHaveBeenCalledWith(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, "203.0.113.7");
  });

  test("returns `null` for a same-origin GET to an endpoint that has no rate limit of its own, without counting the sender", async () => {
    await expect(get({ rateLimit: null })).resolves.toBeNull();
    expect(isWithinRateLimit).not.toHaveBeenCalled();
  });
});

describe("readSubmission", () => {
  test("parses a well-formed body into the submitted fields", async () => {
    await expect(read(VALID_SUBMISSION)).resolves.toEqual({ ok: true, fields: VALID_SUBMISSION });
  });

  test("refuses a cross-origin request before it reads the body or checks the rate limit", async () => {
    const request = jsonPostRequest(ENDPOINT_URL, VALID_SUBMISSION, { origin: "https://elsewhere.example" });

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
  ])("refuses %s with a 413 status code", async (_label, body, headers) => {
    expect(refusalStatus(await read(body, { headers }))).toBe(413);
  });

  test("refuses a request that exceeds the rate limit", async () => {
    isWithinRateLimit.mockResolvedValue(false);
    expect(refusalStatus(await read(VALID_SUBMISSION))).toBe(429);
  });

  test("applies the rate limit before it reads the body", async () => {
    isWithinRateLimit.mockResolvedValue(false);
    expect(refusalStatus(await read("not json at all"))).toBe(429);
  });

  test("keys the rate limit by the sender's IP address", async () => {
    await read(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.7" } });
    expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.7");
  });

  test("keys the rate limit by the fallback key for a request without an IP address", async () => {
    // Requests without an IP address share one key rather than each escaping the limit.
    await read(VALID_SUBMISSION);
    expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "unknown");
  });

  test("parses the body of a request to an endpoint that has no rate limit of its own, without counting the sender", async () => {
    await expect(read(VALID_SUBMISSION, { rateLimit: null })).resolves.toEqual({
      ok: true,
      fields: VALID_SUBMISSION,
    });
    expect(isWithinRateLimit).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that does not parse as JSON", "{"],
    ["a body that is a JSON array instead of an object", "[]"],
  ])("refuses %s with a 400 status code", async (_label, body) => {
    expect(refusalStatus(await read(body))).toBe(400);
  });
});

describe("responseForRefusedSubmission", () => {
  test("returns a 400 response with an empty body for a malformed submission", async () => {
    const response = responseForRefusedSubmission({ ok: false, reason: "malformed" });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBeNull();
    await expect(response.text()).resolves.toBe("");
  });

  test("returns a 400 response with the errors of a submission rejected by the schema", async () => {
    const response = responseForRefusedSubmission<{ from: string }>({
      ok: false,
      reason: "invalid",
      errors: { from: "Enter your email address." },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errors: { from: "Enter your email address." } });
  });
});
