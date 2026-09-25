import type { Mock } from "vitest";

/** Returns the body of the first request made through `fetchMock`, parsed as JSON. */
export const jsonBodyOfFirstRequest = (fetchMock: Mock<typeof fetch>) =>
  JSON.parse(fetchMock.mock.calls[0]![1]?.body as string) as Record<string, unknown>;

/**
 * Makes every later request through `fetchMock` resolve to a response with `status`, whose body is
 * `body` as JSON, or empty when `body` is `undefined`.
 */
export function respondWith(fetchMock: Mock<typeof fetch>, status: number, body?: unknown) {
  fetchMock.mockResolvedValue(body === undefined ? new Response(null, { status }) : Response.json(body, { status }));
}
