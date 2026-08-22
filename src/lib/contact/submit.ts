import type { Errors } from "#/lib/forms/validation";
import { isRecord } from "#/lib/guards";

import type { ContactFields, ContactSubmission } from "./message";

export const CONTACT_ENDPOINT = "/api/contact";

const TOO_MANY_MESSAGES = "You’ve sent too many messages. Try again later.";
const UNAVAILABLE = "The message couldn’t be sent. Try again, or write directly instead.";
const QUOTA_EXCEEDED = "The message couldn’t be sent. Try again later, or write directly instead.";

export type SendResult =
  | { status: "sent" }
  | { status: "invalid"; errors: Errors<ContactFields> } // The server refused what the form let through (i.e. the two schemas disagree).
  | { status: "failed"; message: string };

function invalidResult(body: unknown): SendResult {
  const errors = isRecord(body) && isRecord(body.errors) ? (body.errors as Errors<ContactFields>) : {};
  return { status: "invalid", errors };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function sendMessage(submission: ContactSubmission, signal?: AbortSignal): Promise<SendResult> {
  let response: Response;

  try {
    response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });
  } catch {
    return { status: "failed", message: UNAVAILABLE };
  }

  if (response.ok) {
    return { status: "sent" };
  }

  if (response.status === 400) {
    return invalidResult(await readJson(response));
  }

  if (response.status === 429) {
    return { status: "failed", message: TOO_MANY_MESSAGES };
  }

  if (response.status === 503) {
    return { status: "failed", message: QUOTA_EXCEEDED };
  }

  return { status: "failed", message: UNAVAILABLE };
}
