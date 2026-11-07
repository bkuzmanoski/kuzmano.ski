/**
 * Returns a POST request to `url` with `body` as JSON, or as is when it is a string. The `Origin` header is `origin`,
 * which defaults to the origin of `url`.
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

type RequestHandler = (context: { request: Request }) => Promise<Response>;

interface ApiRoute {
  options: { server?: { handlers?: unknown } };
}

/** HTTP methods defined by an API route's handler record, excluding TanStack's handler factory. */
type HandledMethodsOf<TRoute extends ApiRoute> = Extract<
  keyof Exclude<NonNullable<NonNullable<TRoute["options"]["server"]>["handlers"]>, (...args: never) => unknown>,
  string
>;

/**
 * Returns an API route's request handlers, allowing tests to exercise endpoints as the site serves them. TanStack types
 * `handlers` as either a record or a factory, but every API route here exports a record.
 */
export const requestHandlersOf = <TRoute extends ApiRoute>(route: TRoute) =>
  route.options.server?.handlers as Record<HandledMethodsOf<TRoute>, RequestHandler>;
