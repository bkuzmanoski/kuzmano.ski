import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SITE_NAME } from "#/config/site.ts";

import { GITHUB_TOKEN_BINDING } from "./bindings.ts";
import { fetchGitHubContributionCalendar } from "./github.ts";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env.ts", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const GITHUB_TOKEN = "token";
const LOGIN = "login";

const fetchMock = vi.fn<typeof fetch>();

// A GraphQL response, with the field names the query's aliases give it, whose calendar has a partial
// first week that starts on a Wednesday.
const graphQlResponse = (days: Array<unknown> = [{ date: "2026-01-07", count: 3 }]) =>
  Response.json({
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            total: 5,
            weeks: [{ days }, { days: [{ date: "2026-01-11", count: 2 }] }],
          },
        },
      },
    },
  });

beforeEach(() => {
  env.fails = false;
  env.current = { [GITHUB_TOKEN_BINDING]: GITHUB_TOKEN };
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(graphQlResponse());
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockReturnValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchGitHubContributionCalendar", () => {
  test("returns the total and GitHub's weeks, with a partial first week preserved", async () => {
    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toEqual({
      total: 5,
      weeks: [[{ date: "2026-01-07", count: 3 }], [{ date: "2026-01-11", count: 2 }]],
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  test("sends the token as a `Bearer` credential, the site name as the `User-Agent` header, and the login as a variable", async () => {
    await fetchGitHubContributionCalendar(LOGIN);

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);

    expect(headers.get("authorization")).toBe(`Bearer ${GITHUB_TOKEN}`);
    expect(headers.get("user-agent")).toBe(SITE_NAME);
    expect(JSON.parse(init?.body as string)).toMatchObject({ variables: { login: LOGIN } });
  });

  test("requests the total, each week's days, and each day's count under the aliases the response is parsed with", async () => {
    await fetchGitHubContributionCalendar(LOGIN);

    const { query } = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { query: string };

    expect(query).toContain("total: totalContributions");
    expect(query).toContain("days: contributionDays");
    expect(query).toContain("count: contributionCount");
  });

  test.each([
    ["the token is missing", () => (env.current = {})],
    ["the environment is unreachable", () => (env.fails = true)],
  ])("returns `null` without sending a request, and logs the missing binding, when %s", async (_label, arrange) => {
    arrange();

    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ event: "github_binding_missing" }));
  });

  test("returns `null` and logs the error message when `fetch` rejects", async () => {
    fetchMock.mockRejectedValue(new Error("Timed out."));

    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: "Timed out." }));
  });

  test("returns `null` and logs the status code and body when the API responds with a 401 status code", async () => {
    fetchMock.mockResolvedValue(new Response("Bad credentials", { status: 401 }));

    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ status: 401, body: "Bad credentials" }));
  });

  test("returns `null` and logs the GraphQL errors when the user is `null`", async () => {
    const errors = [{ type: "NOT_FOUND", message: "Could not resolve to a User." }];
    fetchMock.mockResolvedValue(Response.json({ data: { user: null }, errors }));

    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ status: 200, errors }));
  });

  test.each([
    ["a day is missing its count", [{ date: "2026-01-07" }]],
    ["a day's date is not an ISO date", [{ date: "January 7", count: 3 }]],
  ])("returns `null` and logs the failure when %s", async (_label, days) => {
    fetchMock.mockResolvedValue(graphQlResponse(days));

    await expect(fetchGitHubContributionCalendar(LOGIN)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ event: "github_contributions_failed" }));
  });
});
