import { isRecord } from "#/lib/guards";

import { CONTACT_ENDPOINT } from "./endpoint";

export const CONTACT_EMAIL_ADDRESS_STORAGE_KEY = "contact-email-address";

function readCachedContactEmailAddress(): string | null {
  try {
    return sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cacheContactEmailAddress(emailAddress: string) {
  try {
    sessionStorage.setItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY, emailAddress);
  } catch {
    // Ignored.
  }
}

/**
 * The published contact email address, from this session if it has already been read
 * and over the network otherwise. `null` when it cannot be read.
 *
 * Every failure collapses to `null` and is not cached, so the next open retries.
 */
export async function readContactEmailAddress(signal?: AbortSignal): Promise<string | null> {
  const cachedAddress = readCachedContactEmailAddress();

  if (cachedAddress !== null) {
    return cachedAddress;
  }

  try {
    const response = await fetch(CONTACT_ENDPOINT, { headers: { accept: "application/json" }, signal });

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
