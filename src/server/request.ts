/**
 * Maximum request body size, in bytes, accepted by API handlers.
 *
 * The field limits count UTF-16 code units while this counts UTF-8 bytes, and a code unit encodes
 * to at most 3 bytes (a 4-byte character spends two of them). The largest legitimate submission is
 * a contact message: `MESSAGE_MAX_LENGTH` (4,000) plus `MAX_EMAIL_ADDRESS_LENGTH` (254) code units,
 * so about 12.8KB encoded, or 25KB were every one of them escaped to `\uXXXX` by`JSON.stringify`. 32KB covers both and leaves headroom for either limit to grow.
 * `request.test.ts` builds maximal contact and waitlist submissions from those constants and fails
 * if this cap stops admitting them.
 */
export const MAX_BODY_LENGTH = 32_768;

const CONTENT_LENGTH = /^\d+$/;

const encoder = new TextEncoder();

/**
 * Returns whether a request or body exceeds the maximum accepted size.
 *
 * Both branches measure UTF-8 bytes: a request by its declared `Content-Length`, a body by
 * encoding it. A request that declares no length is measured as empty, because `readSubmission`
 * re-checks the body text once it has been read; a length that is not a byte count is refused
 * rather than trusted.
 */
export function exceedsMaxLength(value: Request | string): boolean {
  if (typeof value === "string") {
    return encoder.encode(value).length > MAX_BODY_LENGTH;
  }

  const declared = value.headers.get("content-length");

  if (declared === null) {
    return false;
  }

  return !CONTENT_LENGTH.test(declared) || Number(declared) > MAX_BODY_LENGTH;
}

/** Returns whether a request's `Origin` matches the request URL's origin. */
export const isSameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;

/**
 * Returns whether a request was issued by a page on this site.
 *
 * Browsers omit `Origin` on same-origin GET requests, so a read is checked with
 * `Sec-Fetch-Site` instead. (Easy to forge, but basic friction.)
 */
export const isSameSite = (request: Request) => request.headers.get("sec-fetch-site") === "same-origin";
