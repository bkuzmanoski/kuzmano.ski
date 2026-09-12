/**
 * Maximum API request body size in UTF-8 bytes.
 *
 * Note: Field limits use UTF-16 code units, each of which occupies at most 3 UTF-8 bytes.
 */
export const MAX_BODY_LENGTH = 32_768;

const CONTENT_LENGTH = /^\d+$/;

const utf8Encoder = new TextEncoder();

/** Returns whether a request or body exceeds the maximum accepted size. */
export function exceedsMaxLength(value: Request | string): boolean {
  if (typeof value === "string") {
    return utf8Encoder.encode(value).length > MAX_BODY_LENGTH;
  }

  const declaredLength = value.headers.get("content-length");

  if (declaredLength === null) {
    return false;
  }

  return !CONTENT_LENGTH.test(declaredLength) || Number(declaredLength) > MAX_BODY_LENGTH;
}

/** Returns whether a request's `Origin` matches the request URL's origin. */
export const isSameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;

/** Returns whether a request was issued by a page on this site. */
export const isSameSite = (request: Request) => request.headers.get("sec-fetch-site") === "same-origin";
