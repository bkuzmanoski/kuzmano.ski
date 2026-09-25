import { extendRequestUntil } from "./env.ts";
import { errorMessageOf, logServerEvent } from "./log.ts";

// Caches a route's responses in the Cloudflare data center that serves them.
//
// This applies the Workers Cache API to one route. Enabling Cloudflare's cache in front of the
// Worker with the `cache` setting in `/wrangler.jsonc` would cache every response, including
// documents. Because documents vary by `Accept`, while Cloudflare's cache keys by URL and
// `Accept-Encoding` rather than `Accept` (see `run_worker_first` there), it could return a
// document's HTML for a Markdown request. Caching here also lets a route perform its own checks
// before reading from the cache rather than afterward.
//
// Cloudflare does not document whether the Cache API stores 5xx responses, and `wrangler dev`'s
// cache accepts only HTTP cacheable status codes, which do not include 502. Failed responses are
// therefore stored with status 200, with their original status in `STORED_STATUS_HEADER`.
//
// Stored copies record their storage time in `STORED_AT_HEADER`, allowing browsers to receive the
// remaining lifetime of the data center copy rather than a full lifetime, so both copies expire at
// the same time.

const STORED_STATUS_HEADER = "x-stored-status";
const STORED_AT_HEADER = "x-stored-at"; // Milliseconds since the epoch.

export interface EdgeCacheLifetimes {
  successfulResponseSeconds: number;
  failedResponseSeconds: number;
}

// The data center's cache, or `null` outside Workers (i.e. `vite dev`).
const dataCenterCache = (): Cache | null =>
  (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default ?? null;

// The key a route is cached under: the request's origin and path alone, so a query string or a
// header does not create a second entry.
const cacheKeyFor = (request: Request) => {
  const { origin, pathname } = new URL(request.url);
  return new Request(`${origin}${pathname}`);
};

// A copy of `response` to store, expiring after the lifetime for its outcome.
function storedCopyOf(
  response: Response,
  { successfulResponseSeconds, failedResponseSeconds }: EdgeCacheLifetimes,
): Response {
  const storedCopy = response.ok
    ? new Response(response.body, response)
    : new Response(response.body, { status: 200, headers: response.headers });

  storedCopy.headers.set(STORED_AT_HEADER, String(Date.now()));

  if (response.ok) {
    storedCopy.headers.set("cache-control", `public, max-age=${successfulResponseSeconds}`);
  } else {
    storedCopy.headers.set(STORED_STATUS_HEADER, String(response.status));
    storedCopy.headers.set("cache-control", `public, s-maxage=${failedResponseSeconds}`);
  }

  return storedCopy;
}

// A copy of a stored `response` for the client, without the headers only the data center's copy
// uses. A success has a `max-age` of the seconds its stored copy has left. A failure has its own
// status code restored and is marked `no-store`, since its `s-maxage` is meant for the data
// center's cache alone.
function clientCopyOf(response: Response, { successfulResponseSeconds }: EdgeCacheLifetimes): Response {
  const storedStatus = response.headers.get(STORED_STATUS_HEADER);
  const storedAtMs = Number(response.headers.get(STORED_AT_HEADER));
  const clientCopy = new Response(response.body, {
    status: storedStatus === null ? response.status : Number(storedStatus),
    headers: response.headers,
  });

  clientCopy.headers.delete(STORED_STATUS_HEADER);
  clientCopy.headers.delete(STORED_AT_HEADER);

  if (clientCopy.ok) {
    const storedAgeSeconds = Math.floor((Date.now() - storedAtMs) / 1_000);
    const remainingSeconds = Math.max(0, successfulResponseSeconds - storedAgeSeconds);

    clientCopy.headers.set("cache-control", `public, max-age=${remainingSeconds}`);
  } else {
    clientCopy.headers.set("cache-control", "no-store");
  }

  return clientCopy;
}

const reportFailedStore = (key: Request) => (error: unknown) => {
  logServerEvent("edge_cache_store_failed", { url: key.url, message: errorMessageOf(error) });
};

// The response stored under `key`, or `undefined` when there is none or the cache cannot be read.
async function storedResponseAt(cache: Cache, key: Request): Promise<Response | undefined> {
  try {
    return await cache.match(key);
  } catch (error) {
    logServerEvent("edge_cache_read_failed", { url: key.url, message: errorMessageOf(error) });
    return undefined;
  }
}

/**
 * Returns the cached response until it expires, and otherwise the one `produce` returns, which is
 * stored in the background.
 *
 * The expiry is the stored copy's `Cache-Control` header, which the Cache API honors. Requests that
 * miss at the same time each call `produce`. A failed read is logged and treated as a miss, and a
 * failed store is logged without changing the response, so a failing cache does not fail the route.
 */
export async function edgeCached(
  request: Request,
  lifetimes: EdgeCacheLifetimes,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = dataCenterCache();

  if (!cache) {
    return produce();
  }

  const key = cacheKeyFor(request);
  const cachedResponse = await storedResponseAt(cache, key);

  if (cachedResponse) {
    return clientCopyOf(cachedResponse, lifetimes);
  }

  const storedCopy = storedCopyOf(await produce(), lifetimes);
  const storePromise = cache.put(key, storedCopy.clone()).catch(reportFailedStore(key));

  await extendRequestUntil(storePromise).catch(reportFailedStore(key));

  return clientCopyOf(storedCopy, lifetimes);
}
