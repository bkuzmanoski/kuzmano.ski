import type { ParsedSubmission } from "#/lib/forms/submission.ts";
import { isRecord } from "#/lib/guards.ts";

import { isWithinRateLimit } from "./rate-limit.ts";
import { exceedsMaxLength, isSameOrigin, isSameOriginFetch } from "./request.ts";

import type { RateLimitBindingName } from "./bindings.ts";

const RATE_LIMIT_FALLBACK_KEY = "unknown";

const rateLimitKeyOf = (request: Request) => request.headers.get("cf-connecting-ip") ?? RATE_LIMIT_FALLBACK_KEY;

// Whether the sender of `request` has exceeded `rateLimit`. Always `false` for an endpoint without a rate limit.
const exceedsRateLimit = async (request: Request, rateLimit?: RateLimitBindingName) =>
  rateLimit !== undefined && !(await isWithinRateLimit(rateLimit, rateLimitKeyOf(request)));

export const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Returns a response refusing a GET, or `null` when the endpoint may serve it.
 *
 * The result is a response or `null` rather than a `ReceivedSubmission`, because a GET has no
 * submitted fields to return alongside it.
 */
export async function refusalForGet(request: Request, rateLimit?: RateLimitBindingName): Promise<Response | null> {
  if (!isSameOriginFetch(request)) {
    return new Response(null, { status: 403 });
  }

  if (await exceedsRateLimit(request, rateLimit)) {
    return new Response(null, { status: 429 });
  }

  return null;
}

export type ReceivedSubmission = { ok: true; fields: Record<string, unknown> } | { ok: false; response: Response };

/** Returns a submitted JSON object or a response refusing it. */
export async function readSubmission(request: Request, rateLimit?: RateLimitBindingName): Promise<ReceivedSubmission> {
  const refuse = (status: number) => ({ ok: false as const, response: new Response(null, { status }) });

  if (!isSameOrigin(request)) {
    return refuse(403);
  }

  if (exceedsMaxLength(request)) {
    return refuse(413);
  }

  if (await exceedsRateLimit(request, rateLimit)) {
    return refuse(429);
  }

  const bodyText = await request.text();

  if (exceedsMaxLength(bodyText)) {
    return refuse(413);
  }

  let submission: unknown;

  try {
    submission = JSON.parse(bodyText);
  } catch {
    return refuse(400);
  }

  return isRecord(submission) ? { ok: true, fields: submission } : refuse(400);
}

type RefusedSubmission<TFields> = Extract<ParsedSubmission<unknown, TFields>, { ok: false }>;

export function responseForRefusedSubmission<TFields>(refused: RefusedSubmission<TFields>): Response {
  switch (refused.reason) {
    case "malformed":
      return new Response(null, { status: 400 });

    case "invalid":
      return jsonResponse({ errors: refused.errors }, 400);
  }
}
