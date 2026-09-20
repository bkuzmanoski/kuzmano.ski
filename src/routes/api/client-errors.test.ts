import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";

import { Route } from "./client-errors.ts";

const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("#/server/rate-limit.ts", () => ({ isWithinRateLimit }));

beforeEach(() => {
  vi.spyOn(console, "error").mockReturnValue();
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
});

const ORIGIN = "https://example.com";
const URL = `${ORIGIN}${API_ROUTES.clientErrors}`;
const VALID_REPORT = {
  kind: "render",
  message: "Cannot read properties of null",
  route: "/collection/entry",
  stack: "at Component (entry.tsx:12)",
};

// Use the exported route handler to exercise the endpoint as it is served.
// This route exports a handler record rather than a handler factory.
const { POST } = Route.options.server!.handlers as unknown as {
  POST: (context: { request: Request }) => Promise<Response>;
};

const post = (body: unknown, { origin = ORIGIN }: { origin?: string } = {}) =>
  POST({
    request: new Request(URL, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

test("a well-formed report is logged as a client error", async () => {
  const response = await post(VALID_REPORT);

  expect(response.status).toBe(204);
  expect(console.error).toHaveBeenCalledWith({ event: "client_error", ...VALID_REPORT });
});

test("a report without a kind is logged with an unknown kind", async () => {
  await post({ ...VALID_REPORT, kind: undefined });
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ kind: "unknown" }));
});

test.each([
  ["a report without a message", { ...VALID_REPORT, message: undefined }],
  ["a report without a route", { ...VALID_REPORT, route: undefined }],
  ["a report whose route does not start with `/`", { ...VALID_REPORT, route: "https://elsewhere.example" }],
])("%s is refused", async (_label, body) => {
  expect((await post(body)).status).toBe(400);
  expect(console.error).not.toHaveBeenCalled();
});

test("a message longer than the maximum message length is truncated rather than refused", async () => {
  const response = await post({ ...VALID_REPORT, message: "a".repeat(600) });

  expect(response.status).toBe(204);
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: "a".repeat(500) }));
});

test("a cross-origin request is refused, and a client error is not logged", async () => {
  const response = await post(VALID_REPORT, { origin: "https://elsewhere.example" });

  expect(response.status).toBe(403);
  expect(console.error).not.toHaveBeenCalled();
});

test("reports are not counted against a Worker rate limit", async () => {
  await post(VALID_REPORT);
  expect(isWithinRateLimit).not.toHaveBeenCalled(); // A Cloudflare rule rate limits this route before a request reaches the Worker.
});
