import { SITE_NAME } from "#/config/site.ts";
import { contributionCalendarFrom } from "#/lib/github/contributions.ts";
import type { ContributionCalendar } from "#/lib/github/contributions.ts";
import { isRecord } from "#/lib/guards.ts";
import { readJson } from "#/lib/json.ts";

import { GITHUB_TOKEN_BINDING } from "./bindings.ts";
import { workerEnv } from "./env.ts";
import { errorMessageOf, logServerEvent, reportMissingBinding } from "./log.ts";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const CONTRIBUTION_CALENDAR_QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        total: totalContributions
        weeks { days: contributionDays { date count: contributionCount } }
      }
    }
  }
}`;
const REQUEST_TIMEOUT_MS = 5_000;

const reportMissingGitHubBinding = (binding: string) => reportMissingBinding("github_binding_missing", binding);

async function reportFailedResponse(response: Response) {
  logServerEvent("github_contributions_failed", {
    status: response.status,
    message: "The GitHub API responded with an error status code.",
    body: await response.text().catch(() => ""),
  });
}

function reportFailedRequest(error: unknown) {
  logServerEvent("github_contributions_failed", { message: errorMessageOf(error) });
}

const daysOfWeek = (week: unknown) => (isRecord(week) ? week.days : week);

// Returns the calendar in a GraphQL response, or `null` when the response does not contain a valid one.
function contributionCalendarIn(payload: unknown): ContributionCalendar | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.user)) {
    return null;
  }

  const collection = payload.data.user.contributionsCollection;

  if (!isRecord(collection) || !isRecord(collection.contributionCalendar)) {
    return null;
  }

  const { total, weeks } = collection.contributionCalendar;

  return contributionCalendarFrom({ total, weeks: Array.isArray(weeks) ? weeks.map(daysOfWeek) : weeks });
}

/** Fetches the last year of contributions for `login` from GitHub. Returns `null` when the calendar cannot be read. */
export async function fetchGitHubContributionCalendar(login: string): Promise<ContributionCalendar | null> {
  let token;

  try {
    token = (await workerEnv())[GITHUB_TOKEN_BINDING];
  } catch {
    reportMissingGitHubBinding("the Workers environment");
    return null;
  }

  if (!token) {
    reportMissingGitHubBinding(GITHUB_TOKEN_BINDING);
    return null;
  }

  let response: Response;

  try {
    response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": SITE_NAME,
      },
      body: JSON.stringify({ query: CONTRIBUTION_CALENDAR_QUERY, variables: { login } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    reportFailedRequest(error);
    return null;
  }

  if (!response.ok) {
    await reportFailedResponse(response);
    return null;
  }

  const payload = await readJson(response);
  const calendar = contributionCalendarIn(payload);

  if (!calendar) {
    // A GraphQL error has a 200 status code, and lists what failed in the body's `errors`.
    logServerEvent("github_contributions_failed", {
      status: response.status,
      message: "The GitHub API response does not contain a contribution calendar.",
      errors: isRecord(payload) ? payload.errors : undefined,
    });
    return null;
  }

  return calendar;
}
