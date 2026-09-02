import { isRecord } from "#/lib/guards";

import type { Errors } from "./validation";

export interface InvalidResult<TFields> {
  status: "invalid";
  errors: Errors<TFields>;
}

/** Reads field errors from the body of a rejected submission. */
export function invalidResult<TFields>(body: unknown): InvalidResult<TFields> {
  const errors = isRecord(body) && isRecord(body.errors) ? (body.errors as Errors<TFields>) : {};
  return { status: "invalid", errors };
}

/**
 * Returns the message for the first field with an error, or `fallback` when there are no field
 * errors.
 *
 * `validate` fills errors in schema order, so the first message is for the earliest field to fix.
 */
export function firstMessage<TFields>(errors: Errors<TFields>, fallback: string): string {
  const [message] = Object.values<string>(errors as Record<string, string>);
  return message ?? fallback;
}
