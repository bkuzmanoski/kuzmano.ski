/** Maximum request body size accepted by API handlers. */
export const MAX_BODY_LENGTH = 8_192;

/**
 * Returns whether a request or body exceeds the maximum accepted size.
 *
 * Requests are checked using `Content-Length`; strings are checked by their length.
 */
export const isOversized = (value: Request | string) =>
  (typeof value === "string" ? value.length : Number(value.headers.get("content-length") ?? 0)) > MAX_BODY_LENGTH;

/** Returns whether a request's `Origin` matches the request URL's origin. */
export const isSameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
