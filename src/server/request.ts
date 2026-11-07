/**
 * Maximum API request body size in UTF-8 bytes.
 *
 * Note: Field limits use UTF-16 code units, each of which occupies at most 3 UTF-8 bytes.
 */
export const MAX_BODY_LENGTH = 32_768;

const CONTENT_LENGTH = /^\d+$/;

/** Returns whether a request declares a body longer than the maximum accepted size. */
export function declaresExcessiveLength(request: Request): boolean {
  const declaredLength = request.headers.get("content-length");

  if (declaredLength === null) {
    return false;
  }

  return !CONTENT_LENGTH.test(declaredLength) || Number(declaredLength) > MAX_BODY_LENGTH;
}

/** Reads a request body as text, returning `null` if it exceeds the maximum accepted size. */
export async function readBodyWithinMaxLength(request: Request): Promise<string | null> {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Array<Uint8Array<ArrayBuffer>> = [];

  let byteLength = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    byteLength += chunk.value.byteLength;

    if (byteLength > MAX_BODY_LENGTH) {
      await reader.cancel();
      return null;
    }

    chunks.push(chunk.value);
  }

  return new Blob(chunks).text();
}

/** Returns whether a request's `Origin` matches the request URL's origin. */
export const isSameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;

/** Returns whether a request was issued by a page on this site. */
export const isSameOriginFetch = (request: Request) => request.headers.get("sec-fetch-site") === "same-origin";
