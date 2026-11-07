import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING, SEND_EMAIL_RATELIMIT_BINDING } from "#/server/bindings.ts";
import type { DeliveryResult } from "#/server/mail.ts";
import { getRequestFromSite, jsonPostRequest, requestHandlersOf } from "#/test-utils/requests.ts";

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

const ENDPOINT_URL = `https://example.com${API_ROUTES.contact}`;
const VALID_SUBMISSION = {
  from: "test@example.com",
  message: "Hello.",
};

const { GET, POST } = requestHandlersOf(Route);

const get = (options?: Parameters<typeof getRequestFromSite>[1]) =>
  GET({ request: getRequestFromSite(ENDPOINT_URL, options) });

const post = (body: unknown, options?: Parameters<typeof jsonPostRequest>[2]) =>
  POST({ request: jsonPostRequest(ENDPOINT_URL, body, options) });

test("the endpoint serves the contact email address to a same-origin request", async () => {
  const response = await get();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ emailAddress: EMAIL_ADDRESS });
});

test("the endpoint serves the contact email address with a `Cache-Control: no-store` header", async () => {
  expect((await get()).headers.get("cache-control")).toBe("no-store");
});

test("the endpoint refuses a request from another site before it looks up the contact email address", async () => {
  const response = await get({ site: "cross-site" });

  expect(response.status).toBe(403);
  expect(readContactEmailAddress).not.toHaveBeenCalled();
});

test("the endpoint counts requests to read and send against separate rate limits", async () => {
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

test("the endpoint delivers a well-formed submission, with its sender as the reply-to address", async () => {
  const response = await post(VALID_SUBMISSION);

  expect(response.status).toBe(204);
  expect(deliverMessage).toHaveBeenCalledWith(
    expect.objectContaining({ replyTo: VALID_SUBMISSION.from, text: VALID_SUBMISSION.message }),
  );
});

test("the endpoint refuses a cross-origin request, and does not deliver a message", async () => {
  const response = await post(VALID_SUBMISSION, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(deliverMessage).not.toHaveBeenCalled();
});

test("the endpoint refuses a malformed submission, and does not deliver a message", async () => {
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
