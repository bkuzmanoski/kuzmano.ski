import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { GITHUB_LOGIN } from "#/config/site.ts";
import type { ContributionCalendar } from "#/lib/github/contributions.ts";
import { getRequestFromSite } from "#/test-utils/requests.ts";

import { Route } from "./github-contributions.ts";

const fetchGitHubContributionCalendar = vi.hoisted(() => vi.fn<() => Promise<ContributionCalendar | null>>());
const isWithinRateLimit = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("#/server/github.ts", () => ({ fetchGitHubContributionCalendar }));
vi.mock("#/server/rate-limit.ts", () => ({ isWithinRateLimit }));

const CALENDAR: ContributionCalendar = {
  total: 3,
  weeks: [[{ date: "2026-01-07", count: 3 }]],
};

const dataCenterCache = {
  match: vi.fn<(request: Request) => Promise<Response | undefined>>(),
  put: vi.fn<(request: Request, response: Response) => Promise<void>>(),
};

beforeEach(() => {
  fetchGitHubContributionCalendar.mockReset();
  fetchGitHubContributionCalendar.mockResolvedValue(CALENDAR);
  isWithinRateLimit.mockReset();
  isWithinRateLimit.mockResolvedValue(true);
  dataCenterCache.match.mockReset();
  dataCenterCache.match.mockResolvedValue(undefined);
  dataCenterCache.put.mockReset();
  dataCenterCache.put.mockResolvedValue();
  vi.stubGlobal("caches", { default: dataCenterCache });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL = `https://example.com${API_ROUTES.githubContributions}`;

const { GET } = Route.options.server!.handlers as unknown as {
  GET: (context: { request: Request }) => Promise<Response>;
};

const get = (options?: Parameters<typeof getRequestFromSite>[1]) => GET({ request: getRequestFromSite(URL, options) });

test("the calendar is served to a same-origin request as JSON", async () => {
  const response = await get();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json");
  await expect(response.json()).resolves.toEqual(CALENDAR);
  expect(fetchGitHubContributionCalendar).toHaveBeenCalledWith(GITHUB_LOGIN);
});

test("a request from another site is refused before the cache or the calendar is read", async () => {
  const response = await get({ site: "cross-site" });

  expect(response.status).toBe(403);
  expect(dataCenterCache.match).not.toHaveBeenCalled();
  expect(fetchGitHubContributionCalendar).not.toHaveBeenCalled();
});

test("requests are not counted against a rate limit", async () => {
  await get();
  expect(isWithinRateLimit).not.toHaveBeenCalled();
});

test("the calendar is stored in the data center's cache, and returned, with a `max-age` of an hour", async () => {
  const response = await get();

  expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  expect(dataCenterCache.put.mock.calls[0]?.[1].headers.get("cache-control")).toBe("public, max-age=3600");
});

test("an unreadable calendar responds with a 502 status code and an empty body", async () => {
  fetchGitHubContributionCalendar.mockResolvedValue(null);

  const response = await get();

  expect(response.status).toBe(502);
  await expect(response.text()).resolves.toBe("");
});
