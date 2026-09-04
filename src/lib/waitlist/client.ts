import { API } from "#/api.ts";

import { postSubmission } from "../forms/client.ts";

import type { Membership, WaitlistFields } from "./membership.ts";
import type { InvalidResult } from "../forms/client.ts";

const TOO_MANY_LISTS = "You’ve tried to join too many lists. Try again later.";
const UNAVAILABLE = "The waitlist couldn’t be joined. Try again later.";

export type JoinResult =
  | { status: "joined" }
  | InvalidResult<WaitlistFields> // The server refused what the form let through (i.e. the two schemas disagree).
  | { status: "failed"; message: string };

/** Records a membership. A repeat join succeeds without adding a second row. */
export async function joinWaitlist(submission: Membership, signal?: AbortSignal): Promise<JoinResult> {
  const outcome = await postSubmission<WaitlistFields>(API.waitlist, submission, {
    messages: { 429: TOO_MANY_LISTS },
    fallbackMessage: UNAVAILABLE, // Notion unavailability returns 502; the fallback already tells users to try again later.
    signal,
  });

  return outcome.status === "accepted" ? { status: "joined" } : outcome;
}
