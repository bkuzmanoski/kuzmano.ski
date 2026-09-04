import type { Errors } from "./validation.ts";

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
