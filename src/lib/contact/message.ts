import { EMAIL_ADDRESS_RULES } from "../forms/rules.ts";
import { trimmedStringField } from "../forms/submission.ts";
import { MAX_EMAIL_ADDRESS_LENGTH, maxLength, required, validate } from "../forms/validation.ts";

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
    maxLength(MESSAGE_MAX_LENGTH, `Keep the message under ${MESSAGE_MAX_LENGTH.toLocaleString("en")} characters.`),
  ],
};

export const EMPTY_MESSAGE: ContactFields = { from: "", message: "" };

export function parseSubmission(value: Record<string, unknown>): ParsedSubmission<ContactFields> {
  const from = trimmedStringField(value.from, MAX_EMAIL_ADDRESS_LENGTH);
  const message = trimmedStringField(value.message, MESSAGE_MAX_LENGTH);

  if (from === null || message === null) {
    return { ok: false, reason: "malformed" };
  }

  const trimmedFields: ContactFields = { from, message };
  const errors = validate(CONTACT_SCHEMA, trimmedFields);

  return Object.keys(errors).length > 0 ? { ok: false, reason: "invalid", errors } : { ok: true, value: trimmedFields };
}
