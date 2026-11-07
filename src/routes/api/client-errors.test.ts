import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { jsonPostRequest, requestHandlersOf } from "#/test-utils/requests.ts";

import { Route } from "./client-errors.ts";

const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("#/server/rate-limit.ts", () => ({ isWithinRateLimit }));

beforeEach(() => {
  vi.spyOn(console, "error").mockReturnValue();
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const ENDPOINT_URL = `https://example.com${API_ROUTES.clientErrors}`;
const VALID_REPORT = {
  kind: "render",
  message: "Cannot read properties of null",
  route: "/collection/entry",
  stack: "at Component (entry.tsx:12)",
};

const { POST } = requestHandlersOf(Route);

const post = (body: unknown, options?: Parameters<typeof jsonPostRequest>[2]) =>
  POST({ request: jsonPostRequest(ENDPOINT_URL, body, options) });

test("the endpoint logs a well-formed report as a client error", async () => {
  const response = await post(VALID_REPORT);

  expect(response.status).toBe(204);
  expect(console.error).toHaveBeenCalledWith({ event: "client_error", ...VALID_REPORT });
});

test("the endpoint logs a report without a kind with an unknown kind", async () => {
  await post({ ...VALID_REPORT, kind: undefined });
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ kind: "unknown" }));
});

test.each([
  ["a report without a message", { ...VALID_REPORT, message: undefined }],
  ["a report without a route", { ...VALID_REPORT, route: undefined }],
  ["a report whose route does not start with `/`", { ...VALID_REPORT, route: "https://elsewhere.example" }],
])("the endpoint refuses %s with a 400 status code", async (_label, body) => {
  expect((await post(body)).status).toBe(400);
  expect(console.error).not.toHaveBeenCalled();
});

test("the endpoint truncates a message longer than the maximum message length rather than refusing the report", async () => {
  const response = await post({ ...VALID_REPORT, message: "a".repeat(600) });

  expect(response.status).toBe(204);
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: "a".repeat(500) }));
});

test("the endpoint refuses a cross-origin request, and does not log a client error", async () => {
  const response = await post(VALID_REPORT, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(console.error).not.toHaveBeenCalled();
});

test("the endpoint does not count reports against a Worker rate limit", async () => {
  await post(VALID_REPORT);
  expect(isWithinRateLimit).not.toHaveBeenCalled(); // A Cloudflare rule rate limits this route before a request reaches the Worker.
});
