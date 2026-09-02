import { API } from "#/api";
import { invalidResult } from "#/lib/forms/server";
import type { InvalidResult } from "#/lib/forms/server";
import { isRecord } from "#/lib/guards";
import { readJson } from "#/lib/json";

import type { ContactFields } from "./message";

export const CONTACT_EMAIL_ADDRESS_STORAGE_KEY = "contact-email-address";

function cacheContactEmailAddress(emailAddress: string) {
  try {
    sessionStorage.setItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY, emailAddress);
  } catch {
    // Ignored.
  }
}

function readCachedContactEmailAddress(): string | null {
  try {
    return sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Reads the published contact email address from the current session, or from the
 * server if the session does not have it. Returns `null` when it cannot be read.
 */
export async function readContactEmailAddress(signal?: AbortSignal): Promise<string | null> {
  const cachedAddress = readCachedContactEmailAddress();

  if (cachedAddress !== null) {
    return cachedAddress;
  }

  try {
    const response = await fetch(API.contact, { headers: { accept: "application/json" }, signal });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();

    if (!isRecord(body) || typeof body.emailAddress !== "string") {
      return null;
    }

    cacheContactEmailAddress(body.emailAddress);

    return body.emailAddress;
  } catch {
    return null;
  }
}

export const SEND_FAILED_MESSAGE = "The message couldn’t be sent.";

const TOO_MANY_MESSAGES = "You’ve sent too many messages. Try again later.";
const UNAVAILABLE = "The message couldn’t be sent. Try again, or write directly instead.";
const QUOTA_EXCEEDED = "The message couldn’t be sent. Try again later, or write directly instead.";

export type SendResult =
  | { status: "sent" }
  | InvalidResult<ContactFields> // The server refused what the form let through (i.e. the two schemas disagree).
  | { status: "failed"; message: string };

export async function sendMessage(submission: ContactFields, signal?: AbortSignal): Promise<SendResult> {
  let response: Response;

  try {
    response = await fetch(API.contact, {
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
    return invalidResult<ContactFields>(await readJson(response));
  }

  if (response.status === 429) {
    return { status: "failed", message: TOO_MANY_MESSAGES };
  }

  if (response.status === 503) {
    return { status: "failed", message: QUOTA_EXCEEDED };
  }

  return { status: "failed", message: UNAVAILABLE };
}
