import { EMAIL_ADDRESS_RULES } from "#/lib/forms/rules";
import type { ParsedSubmission } from "#/lib/forms/submission";
import { MAX_ADDRESS_LENGTH, isWithinLengthLimit, validate } from "#/lib/forms/validation";
import type { Schema } from "#/lib/forms/validation";

export const LIST_MAX_LENGTH = 64;

const SOURCE_MAX_LENGTH = 512;

export interface WaitlistFields {
  emailAddress: string;
}

export const WAITLIST_SCHEMA: Schema<WaitlistFields> = {
  emailAddress: EMAIL_ADDRESS_RULES,
};

export const EMPTY_MEMBERSHIP: WaitlistFields = { emailAddress: "" };

export interface Membership extends WaitlistFields {
  list: string;
  source: string; // The path to the page where the waitlist was joined.
}

const isSitePath = (value: string) => value.startsWith("/") && !value.startsWith("//");

export function parseSubmission(value: Record<string, unknown>): ParsedSubmission<Membership, WaitlistFields> {
  const { emailAddress, list, source } = value;

  // Lengths are measured before trimming, so a value that exceeds its limit is malformed rather
  // than shortened into an accepted one.
  if (
    typeof emailAddress !== "string" ||
    !isWithinLengthLimit(emailAddress, MAX_ADDRESS_LENGTH) ||
    typeof list !== "string" ||
    !isWithinLengthLimit(list, LIST_MAX_LENGTH) ||
    typeof source !== "string" ||
    !isWithinLengthLimit(source, SOURCE_MAX_LENGTH)
  ) {
    return { ok: false, reason: "malformed" };
  }

  const trimmedList = list.trim();
  const trimmedSource = source.trim();

  if (trimmedList.length === 0 || !isSitePath(trimmedSource)) {
    return { ok: false, reason: "malformed" };
  }

  const fields: WaitlistFields = { emailAddress: emailAddress.trim() };
  const errors = validate(WAITLIST_SCHEMA, fields);

  return Object.keys(errors).length > 0
    ? { ok: false, reason: "invalid", errors }
    : { ok: true, value: { ...fields, list: trimmedList, source: trimmedSource } };
}
