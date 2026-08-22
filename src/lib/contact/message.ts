import { emailAddress, maxLength, required, validate } from "#/lib/forms/validation";
import type { Errors, Schema } from "#/lib/forms/validation";

export const FROM_MAX_LENGTH = 254;
export const MESSAGE_MAX_LENGTH = 4_000;
export const MIN_COMPOSE_MS = 3_000;

export interface ContactFields {
  from: string;
  message: string;
}

export const CONTACT_SCHEMA: Schema<ContactFields> = {
  from: [
    required("Enter your email address."),
    maxLength(FROM_MAX_LENGTH, "That email address is too long."),
    emailAddress("That doesn’t look like an email address."),
  ],
  message: [
    required("Write a message to send."),
    maxLength(MESSAGE_MAX_LENGTH, `Keep the message under ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`),
  ],
};

export const EMPTY_MESSAGE: ContactFields = { from: "", message: "" };

/**
 * A message plus its bot trap.
 *
 * - `website` is a field only a form-filler can see.
 * - `elapsedMs` is how long the form was open, measured by the client.
 */
export interface ContactSubmission extends ContactFields {
  website: string;
  elapsedMs: number;
}

export type ParsedSubmission =
  | { ok: true; fields: ContactFields }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "rejected" } // Tripped the bot trap. Answered as success.
  | { ok: false; reason: "invalid"; errors: Errors<ContactFields> };

const WEBSITE_MAX_LENGTH = 4_000;

const trimmedString = (value: unknown, limit: number): string | null =>
  typeof value === "string" && value.length <= limit ? value.trim() : null;

export function parseSubmission(value: Record<string, unknown>): ParsedSubmission {
  const from = trimmedString(value.from, FROM_MAX_LENGTH);
  const message = trimmedString(value.message, MESSAGE_MAX_LENGTH);
  const website = trimmedString(value.website, WEBSITE_MAX_LENGTH);
  const elapsedMs = value.elapsedMs;

  if (from === null || message === null || website === null || typeof elapsedMs !== "number") {
    return { ok: false, reason: "malformed" };
  }

  if (website.length > 0 || !Number.isFinite(elapsedMs) || elapsedMs < MIN_COMPOSE_MS) {
    return { ok: false, reason: "rejected" };
  }

  const fields: ContactFields = { from, message };
  const errors = validate(CONTACT_SCHEMA, fields);

  return Object.keys(errors).length > 0 ? { ok: false, reason: "invalid", errors } : { ok: true, fields };
}
