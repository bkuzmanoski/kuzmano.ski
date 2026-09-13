import { EMAIL_ADDRESS_RULES } from "../forms/rules.ts";
import { trimmedStringField } from "../forms/submission.ts";
import { MAX_EMAIL_ADDRESS_LENGTH, validate } from "../forms/validation.ts";

import type { ParsedSubmission } from "../forms/submission.ts";
import type { Schema } from "../forms/validation.ts";

export const LIST_MAX_LENGTH = 64;
export const SOURCE_MAX_LENGTH = 512;

export interface WaitlistFields {
  emailAddress: string;
}

export const WAITLIST_SCHEMA: Schema<WaitlistFields> = {
  emailAddress: EMAIL_ADDRESS_RULES,
};

export const EMPTY_MEMBERSHIP: WaitlistFields = { emailAddress: "" };

export interface Membership extends WaitlistFields {
  list: string;
  source: string; // The path to the entry where the waitlist was joined.
}

const isSitePath = (value: string) => value.startsWith("/") && !value.startsWith("//");

export function parseSubmission(value: Record<string, unknown>): ParsedSubmission<Membership, WaitlistFields> {
  const emailAddress = trimmedStringField(value.emailAddress, MAX_EMAIL_ADDRESS_LENGTH);
  const list = trimmedStringField(value.list, LIST_MAX_LENGTH);
  const source = trimmedStringField(value.source, SOURCE_MAX_LENGTH);

  if (emailAddress === null || list === null || list.length === 0 || source === null || !isSitePath(source)) {
    return { ok: false, reason: "malformed" };
  }

  const trimmedFields: WaitlistFields = { emailAddress };
  const errors = validate(WAITLIST_SCHEMA, trimmedFields);

  return Object.keys(errors).length > 0
    ? { ok: false, reason: "invalid", errors }
    : { ok: true, value: { ...trimmedFields, list, source } };
}
