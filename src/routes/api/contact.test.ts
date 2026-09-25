import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "#/server/bindings.ts";
import type { DeliveryResult } from "#/server/mail.ts";
import { getRequestFromSite, jsonPostRequest } from "#/test-utils/requests.ts";

import { Route } from "./contact.ts";

const deliverMessage = vi.hoisted(() => vi.fn<() => Promise<DeliveryResult>>());
const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const readContactEmailAddress = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("#/server/mail.ts", () => ({ deliverMessage }));
vi.mock("#/server/rate-limit.ts", () => ({ isWithinRateLimit }));
vi.mock("#/server/contact-email-address.ts", () => ({ readContactEmailAddress }));

const EMAIL_ADDRESS = "inbox@example.com";

beforeEach(() => {
  deliverMessage.mockReset();
  deliverMessage.mockResolvedValue("sent");
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
  readContactEmailAddress.mockReset();
  readContactEmailAddress.mockResolvedValue(EMAIL_ADDRESS);
});

const URL = `https://example.com${API_ROUTES.contact}`;
const VALID_SUBMISSION = {
  from: "test@example.com",
  message: "Hello.",
};

// Use the exported route handler to exercise the endpoint as it is served.
// This route exports a handler record rather than a handler factory.
const { GET, POST } = Route.options.server!.handlers as unknown as {
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
};

const get = (options?: Parameters<typeof getRequestFromSite>[1]) => GET({ request: getRequestFromSite(URL, options) });

const post = (body: unknown, options?: Parameters<typeof jsonPostRequest>[2]) =>
  POST({ request: jsonPostRequest(URL, body, options) });

test("the contact email address is served to a same-origin request", async () => {
  const response = await get();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ emailAddress: EMAIL_ADDRESS });
});

test("the contact email address is served with a `Cache-Control: no-store` header", async () => {
  expect((await get()).headers.get("cache-control")).toBe("no-store");
});

test("a request from another site is refused before the contact email address is looked up", async () => {
  const response = await get({ site: "cross-site" });

  expect(response.status).toBe(403);
  expect(readContactEmailAddress).not.toHaveBeenCalled();
});

test("requests to read and send are counted against separate rate limits", async () => {
  await get({ headers: { "cf-connecting-ip": "203.0.113.7" } });

  expect(isWithinRateLimit).toHaveBeenCalledWith(CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, "203.0.113.7");

  await post(VALID_SUBMISSION, { headers: { "cf-connecting-ip": "203.0.113.7" } });

  expect(isWithinRateLimit).toHaveBeenCalledWith(SEND_EMAIL_RATELIMIT_BINDING, "203.0.113.7");
});

test("a missing contact email address responds with a 502 status code and an empty body", async () => {
  readContactEmailAddress.mockResolvedValue(null);

  const response = await get();

  expect(response.status).toBe(502);
  await expect(response.text()).resolves.toBe("");
});

test("a well-formed submission is delivered, with its sender as the reply-to address", async () => {
  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(204);
  expect(deliverMessage).toHaveBeenCalledWith(
    expect.objectContaining({ replyTo: VALID_SUBMISSION.from, text: VALID_SUBMISSION.message }),
  );
});

test("a cross-origin request is refused, and a message is not delivered", async () => {
  const response = await post(VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(deliverMessage).not.toHaveBeenCalled();
});

test("a malformed submission is refused, and a message is not delivered", async () => {
  expect((await post({ ...VALID_SUBMISSION, from: undefined })).status).toBe(400);
  expect(deliverMessage).not.toHaveBeenCalled();
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
] as const)("a delivery of `%s` responds with a %i status code", async (delivery, status) => {
  deliverMessage.mockResolvedValue(delivery);
  expect((await post(VALID_SUBMISSION)).status).toBe(status);
});

test("a delivery of `unavailable` responds with a 502 status code and an empty body", async () => {
  deliverMessage.mockResolvedValue("unavailable");

  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(502);
  await expect(response.text()).resolves.toBe("");
});
