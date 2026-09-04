import { API } from "#/api.ts";

import { postSubmission } from "../forms/client.ts";
import { isRecord } from "../guards.ts";

import type { ContactFields } from "./message.ts";
import type { InvalidResult } from "../forms/client.ts";

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
  const outcome = await postSubmission<ContactFields>(API.contact, submission, {
    messages: { 429: TOO_MANY_MESSAGES, 503: QUOTA_EXCEEDED }, // A 503 means the send quota has run out, so its message says to try later rather than again now.
    fallbackMessage: UNAVAILABLE,
    signal,
  });

  return outcome.status === "accepted" ? { status: "sent" } : outcome;
}
