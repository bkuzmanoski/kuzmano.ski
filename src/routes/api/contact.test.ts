import { beforeEach, expect, test, vi } from "vitest";

import { MESSAGE_MAX_LENGTH, MIN_COMPOSE_MS } from "#/lib/contact/message";
import type { Delivery } from "#/server/mail";
import { MAX_BODY_LENGTH } from "#/server/request";

import { Route } from "./contact";

const deliver = vi.hoisted(() => vi.fn<() => Promise<Delivery>>());
const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("#/server/mail", () => ({ deliver }));
vi.mock("#/server/rate-limit", () => ({ isWithinRateLimit }));

beforeEach(() => {
  deliver.mockReset();
  deliver.mockResolvedValue("sent");
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const ORIGIN = "https://kuzmano.ski";
const URL = `${ORIGIN}/api/contact`;
const VALID_SUBMISSION = { from: "test@example.com", message: "Hello.", website: "", elapsedMs: MIN_COMPOSE_MS };

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

test("a well-formed submission is delivered, replying to its sender", async () => {
  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(204);
  expect(deliver).toHaveBeenCalledWith(
    expect.objectContaining({ replyTo: VALID_SUBMISSION.from, text: VALID_SUBMISSION.message }),
  );
});

test("a cross-origin request is refused before anything is read", async () => {
  const response = await post(VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(isWithinRateLimit).not.toHaveBeenCalled();
  expect(deliver).not.toHaveBeenCalled();
});

test.each([
  ["a declared content length that exceeds the limit", "{}", { "content-length": String(MAX_BODY_LENGTH + 1) }],
  ["a body that exceeds the maximum length", `{"pad":"${"a".repeat(MAX_BODY_LENGTH)}"}`, {}],
])("%s is refused", async (_label, body, headers) => {
  expect((await post(body, { headers })).status).toBe(413);
  expect(deliver).not.toHaveBeenCalled();
});

test("the rate limit is applied before the body is read", async () => {
  isWithinRateLimit.mockResolvedValue(false);

  const response = await post("not json at all");

  expect(response.status).toBe(429);
  expect(deliver).not.toHaveBeenCalled();
});

test.each([
  ["invalid JSON", "{"],
  ["a JSON array instead of an object", "[]"],
  ["a missing field", { ...VALID_SUBMISSION, from: undefined }],
  ["a field with the wrong type", { ...VALID_SUBMISSION, message: 42 }],
  [
    "a field longer than the endpoint allows",
    {
      ...VALID_SUBMISSION,
      message: "a".repeat(MESSAGE_MAX_LENGTH + 1),
    },
  ],
])("%s is rejected", async (_label, body) => {
  expect((await post(body)).status).toBe(400);
  expect(deliver).not.toHaveBeenCalled();
});

test.each([
  ["has the website field filled", { ...VALID_SUBMISSION, website: "https://example.com" }],
  [
    "has the website field filled to its maximum length",
    {
      ...VALID_SUBMISSION,
      website: "https://example.com/".repeat(200),
    },
  ],
  [
    "claims an implausibly short composition time",
    {
      ...VALID_SUBMISSION,
      elapsedMs: MIN_COMPOSE_MS - 1,
    },
  ],
])("a submission that  %s is accepted but not delivered", async (_label, body) => {
  expect((await post(body)).status).toBe(204);
  expect(deliver).not.toHaveBeenCalled();
});

test("a submission rejected by the schema returns its errors", async () => {
  const response = await post({ ...VALID_SUBMISSION, from: "nope" });
  const body = (await response.json()) as { errors: Record<string, string> };

  expect(response.status).toBe(400);
  expect(typeof body.errors.from).toBe("string");
});

test.each([
  ["sent", 204],
  ["throttled", 429],
  ["unavailable", 502],
  ["exhausted", 503],
] as const)('returns "%i" when the status code is %s', async (delivery, status) => {
  deliver.mockResolvedValue(delivery);
  expect((await post(VALID_SUBMISSION)).status).toBe(status);
});

test("a failed delivery does not expose its reason", async () => {
  deliver.mockResolvedValue("unavailable");

  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(502);
  await expect(response.text()).resolves.toBe("");
});

test("rate limiting uses the sender's IP address as its key", async () => {
  await post(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.7" } });
  expect(isWithinRateLimit).toHaveBeenCalledWith("203.0.113.7");
});

test("a request with no IP address shares one bucket rather than escaping the limit", async () => {
  await post(VALID_SUBMISSION);
  expect(isWithinRateLimit).toHaveBeenCalledWith("unknown");
});
