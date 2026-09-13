import { isWithinLengthLimit } from "./validation.ts";

import type { Errors } from "./validation.ts";

/**
 * Reads a field from a submitted body as a trimmed string. Returns `null` when the field is missing, is
 * not a string, or is longer than `limit`.
 *
 * The limit is checked before trimming, so an over-long value is malformed rather than shortened into an
 * accepted one.
 */
export function trimmedStringField(value: unknown, limit: number): string | null {
  return typeof value === "string" && isWithinLengthLimit(value, limit) ? value.trim() : null;
}

/**
 * The outcome of parsing a submitted body.
 *
 * `TParsed` is the value produced by a valid submission. `TFields` names the fields whose
 * validation can produce errors and defaults to `TParsed`.
 */
export type ParsedSubmission<TParsed, TFields = TParsed> =
  | { ok: true; value: TParsed }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "invalid"; errors: Errors<TFields> };
