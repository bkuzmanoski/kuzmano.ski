import { EMAIL_ADDRESS_RULES } from "../forms/rules.ts";
import { MAX_EMAIL_ADDRESS_LENGTH, isWithinLengthLimit, maxLength, required, validate } from "../forms/validation.ts";

import type { ParsedSubmission } from "../forms/submission.ts";
import type { Schema } from "../forms/validation.ts";

export const MESSAGE_MAX_LENGTH = 4_000;

export interface ContactFields {
  from: string;
  message: string;
}

export const CONTACT_SCHEMA: Schema<ContactFields> = {
  from: EMAIL_ADDRESS_RULES,
  message: [
    required("Write a message to send."),
    maxLength(MESSAGE_MAX_LENGTH, `Keep the message under ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`),
  ],
};

export const EMPTY_MESSAGE: ContactFields = { from: "", message: "" };

export function parseSubmission(value: Record<string, unknown>): ParsedSubmission<ContactFields> {
  const { from, message } = value;

  // Lengths are measured before trimming, so a value that exceeds its limit is malformed rather
  // than shortened into an accepted one.
  if (
    typeof from !== "string" ||
    !isWithinLengthLimit(from, MAX_EMAIL_ADDRESS_LENGTH) ||
    typeof message !== "string" ||
    !isWithinLengthLimit(message, MESSAGE_MAX_LENGTH)
  ) {
    return { ok: false, reason: "malformed" };
  }

  const fields: ContactFields = { from: from.trim(), message: message.trim() };
  const errors = validate(CONTACT_SCHEMA, fields);

  return Object.keys(errors).length > 0 ? { ok: false, reason: "invalid", errors } : { ok: true, value: fields };
}
