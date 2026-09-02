import type { ParsedSubmission } from "#/lib/forms/submission";
import { isRecord } from "#/lib/guards";

import { isWithinRateLimit } from "./rate-limit";
import { isOversized, isSameOrigin } from "./request";

import type { RateLimitBindingName } from "./bindings";

const RATE_LIMIT_FALLBACK_KEY = "unknown";

export const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const senderKey = (request: Request) => request.headers.get("cf-connecting-ip") ?? RATE_LIMIT_FALLBACK_KEY;

export type ReceivedSubmission = { ok: true; fields: Record<string, unknown> } | { ok: false; response: Response };

/** Returns a submitted JSON object or a response refusing it. */
export async function readSubmission(request: Request, rateLimit?: RateLimitBindingName): Promise<ReceivedSubmission> {
  const refuse = (status: number) => ({ ok: false as const, response: new Response(null, { status }) });

  if (!isSameOrigin(request)) {
    return refuse(403);
  }

  if (isOversized(request)) {
    return refuse(413);
  }

  if (rateLimit && !(await isWithinRateLimit(rateLimit, senderKey(request)))) {
    return refuse(429);
  }

  const body = await request.text();

  if (isOversized(body)) {
    return refuse(413);
  }

  let submission: unknown;

  try {
    submission = JSON.parse(body);
  } catch {
    return refuse(400);
  }

  return isRecord(submission) ? { ok: true, fields: submission } : refuse(400);
}

type RefusedSubmission<TFields> = Extract<ParsedSubmission<unknown, TFields>, { ok: false }>;

export function refusalFor<TFields>(refused: RefusedSubmission<TFields>): Response {
  switch (refused.reason) {
    case "malformed":
      return new Response(null, { status: 400 });

    case "invalid":
      return json({ errors: refused.errors }, 400);
  }
}
