import { API_ROUTES } from "#/api-routes.ts";

import { readJson } from "../json.ts";

import { contributionCalendarFrom } from "./contributions.ts";

import type { ContributionCalendar } from "./contributions.ts";

/** Reads the contribution calendar from the Worker. Returns `null` when the calendar cannot be read. */
export async function readContributionCalendar(): Promise<ContributionCalendar | null> {
  let response: Response;

  try {
    response = await fetch(API_ROUTES.githubContributions, { headers: { accept: "application/json" } });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return contributionCalendarFrom(await readJson(response));
}
