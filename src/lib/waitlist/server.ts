import { API } from "#/api";
import { invalidResult } from "#/lib/forms/server";
import type { InvalidResult } from "#/lib/forms/server";
import { readJson } from "#/lib/json";

import type { Membership, WaitlistFields } from "./membership";

const TOO_MANY_LISTS = "You’ve tried to join too many lists. Try again later.";
const UNAVAILABLE = "The waitlist couldn’t be joined. Try again later.";

export type JoinResult =
  | { status: "joined" }
  | InvalidResult<WaitlistFields> // The server refused what the form let through (i.e. the two schemas disagree).
  | { status: "failed"; message: string };

/** Records a membership. A repeat join succeeds without adding a second row. */
export async function joinWaitlist(submission: Membership, signal?: AbortSignal): Promise<JoinResult> {
  let response: Response;

  try {
    response = await fetch(API.waitlist, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });
  } catch {
    return { status: "failed", message: UNAVAILABLE };
  }

  if (response.ok) {
    return { status: "joined" };
  }

  if (response.status === 400) {
    return invalidResult<WaitlistFields>(await readJson(response));
  }

  if (response.status === 429) {
    return { status: "failed", message: TOO_MANY_LISTS };
  }

  return { status: "failed", message: UNAVAILABLE };
}
