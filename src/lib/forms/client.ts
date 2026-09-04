import { isRecord } from "../guards.ts";
import { readJson } from "../json.ts";

import type { Errors } from "./validation.ts";

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

export type SubmissionOutcome<TFields> =
  { status: "accepted" } | InvalidResult<TFields> | { status: "failed"; message: string };

interface PostOptions {
  messages?: Record<number, string>; // The message to show for a refusal the form handles itself, keyed by status.
  fallbackMessage: string; // The message to show when no response arrived, or its status is not in `messages`.
  signal?: AbortSignal;
}

/**
 * Posts a submission as JSON and reads the response, without throwing.
 *
 * A `400` includes field errors and always produces an invalid result; every other refusal
 * produces a message to show. Statuses are listed per form rather than shared, because the same
 * status can mean different things to different endpoints.
 */
export async function postSubmission<TFields>(
  endpoint: string,
  submission: unknown,
  { messages = {}, fallbackMessage, signal }: PostOptions,
): Promise<SubmissionOutcome<TFields>> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });
  } catch {
    return { status: "failed", message: fallbackMessage };
  }

  if (response.ok) {
    return { status: "accepted" };
  }

  if (response.status === 400) {
    return invalidResult<TFields>(await readJson(response));
  }

  return { status: "failed", message: messages[response.status] ?? fallbackMessage };
}
