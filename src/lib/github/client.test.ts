import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { respondWith } from "#/test-utils/fetch.ts";

import { readContributionCalendar } from "./client.ts";

const CONTRIBUTION_CALENDAR = {
  total: 1234,
  weeks: [
    [
      { date: "2026-01-02", count: 0 },
      { date: "2026-01-03", count: 7 },
    ],
    [{ date: "2026-01-04", count: 2 }],
  ],
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

test("the contribution calendar is read from the endpoint as JSON", async () => {
  respondWith(fetchMock, 200, CONTRIBUTION_CALENDAR);

  expect(await readContributionCalendar()).toEqual(CONTRIBUTION_CALENDAR);
  expect(fetchMock.mock.calls[0]?.[0]).toBe(API_ROUTES.githubContributions);
  expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("accept")).toBe("application/json");
});

test("`null` is returned when the endpoint responds with a 502 status code", async () => {
  respondWith(fetchMock, 502);
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when `fetch` rejects", async () => {
  fetchMock.mockRejectedValue(new Error("Offline."));
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when the body is not a calendar", async () => {
  respondWith(fetchMock, 200, { total: 1234 });
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when a week is not an array", async () => {
  respondWith(fetchMock, 200, { ...CONTRIBUTION_CALENDAR, weeks: [{ date: "2026-01-04", count: 2 }] });
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when a day is missing its count", async () => {
  respondWith(fetchMock, 200, { ...CONTRIBUTION_CALENDAR, weeks: [[{ date: "2026-01-04" }]] });
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when a day's date is not an ISO date", async () => {
  respondWith(fetchMock, 200, { ...CONTRIBUTION_CALENDAR, weeks: [[{ date: "January 4", count: 2 }]] });
  expect(await readContributionCalendar()).toBeNull();
});

test("`null` is returned when the body is not JSON", async () => {
  fetchMock.mockResolvedValue(new Response("<html></html>", { status: 200 }));
  expect(await readContributionCalendar()).toBeNull();
});

test("a calendar without weeks is parsed into an empty contribution calendar", async () => {
  respondWith(fetchMock, 200, { total: 0, weeks: [] });
  expect(await readContributionCalendar()).toEqual({ total: 0, weeks: [] });
});
