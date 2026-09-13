import { beforeEach, expect, test, vi } from "vitest";

import { API } from "#/api.ts";

import { reportClientError } from "./client.ts";

import type { ClientErrorReport } from "./client.ts";

const REPORT: ClientErrorReport = {
  kind: "router-error-boundary",
  message: "Unreadable frontmatter.",
  route: "/page",
  stack: "Error: Unreadable frontmatter.\n    at read",
};

const beacon = vi.fn<typeof navigator.sendBeacon>();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  navigator.sendBeacon = beacon;
  vi.stubGlobal("fetch", fetchMock);
  beacon.mockReset();
  beacon.mockReturnValue(true);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
});

test("reporting an error queues the report as a JSON beacon to the client errors endpoint", async () => {
  reportClientError(REPORT);

  const [url, blob] = beacon.mock.calls[0]!;

  expect(url).toBe(API.clientErrors);
  expect((blob as Blob).type).toBe("application/json");
  await expect((blob as Blob).text()).resolves.toBe(JSON.stringify(REPORT));
  expect(fetchMock).not.toHaveBeenCalled();
});

test("reporting an error posts the report as a `keepalive` request when `sendBeacon` returns `false`", () => {
  beacon.mockReturnValue(false);
  reportClientError(REPORT);

  const [url, init] = fetchMock.mock.calls[0]!;

  expect(url).toBe(API.clientErrors);
  expect(init?.method).toBe("POST");
  expect(init?.keepalive).toBe(true);
  expect(JSON.parse(init?.body as string)).toEqual(REPORT);
});

test("reporting an error does not throw when the fallback request fails", () => {
  beacon.mockReturnValue(false);
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

  expect(() => reportClientError(REPORT)).not.toThrow();
});

test("reporting an error does not throw or post a fallback request when `sendBeacon` throws", () => {
  beacon.mockImplementation(() => {
    throw new Error("Denied.");
  });

  expect(() => reportClientError(REPORT)).not.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
