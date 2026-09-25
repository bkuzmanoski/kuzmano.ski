/**
 * Returns a POST request to `url` with `body` as JSON, or as is when it is a string. The `Origin`
 * header is `origin`, which defaults to the origin of `url`.
 */
export function jsonPostRequest(
  url: string,
  body: unknown,
  { origin = new URL(url).origin, headers = {} }: { origin?: string; headers?: HeadersInit } = {},
): Request {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Returns a GET request to `url` whose `Sec-Fetch-Site` header is `site`, which defaults to `same-origin`. */
export const getRequestFromSite = (
  url: string,
  { site = "same-origin", headers = {} }: { site?: string; headers?: HeadersInit } = {},
): Request => new Request(url, { headers: { "sec-fetch-site": site, ...headers } });
