import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { edgeCached } from "./edge-cache.ts";

const NOW_MS = new Date("2026-09-21T00:00:00Z").getTime();

const backgroundPromises = vi.hoisted((): Array<Promise<unknown>> => []);
const extendRequestUntil = vi.hoisted(() =>
  vi.fn((promise: Promise<unknown>) => {
    backgroundPromises.push(promise);
    return Promise.resolve();
  }),
);

vi.mock("./env.ts", () => ({ extendRequestUntil }));

beforeEach(() => {
  vi.useFakeTimers({ now: NOW_MS });
  vi.spyOn(console, "error").mockReturnValue();
  backgroundPromises.length = 0;
  extendRequestUntil.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LIFETIMES = { successfulResponseSeconds: 60, failedResponseSeconds: 30 };
const ENDPOINT_URL = "https://example.com/api/endpoint";
const STORABLE_STATUS_CODES = new Set([200, 203, 204, 300, 301, 302, 303, 307, 308, 404, 405, 410, 414, 501]); // The status codes `wrangler dev`'s cache stores, which are the ones `http-cache-semantics` understands.

// The number of seconds a shared cache stores a response for: its `s-maxage`, or else its `max-age`.
function sharedCacheLifetimeSecondsOf(response: Response): number {
  const cacheControl = response.headers.get("cache-control") ?? "";
  const sharedMaxAge = /\bs-maxage=(\d+)/.exec(cacheControl)?.[1];
  const maxAge = /(?:^|[\s,])max-age=(\d+)/.exec(cacheControl)?.[1];

  return Number(sharedMaxAge ?? maxAge ?? 0);
}

// A `Cache` storing responses by URL until the expiry their `Cache-Control` header specifies, and
// only with a status code in `STORABLE_STATUS_CODES`, as `wrangler dev`'s cache does. It is
// installed as `caches.default` the way Workers provides the data center's cache.
function memoryCache() {
  const entries = new Map<string, { response: Response; expiresAt: number }>();
  const cache = {
    match: vi.fn((request: Request) => {
      const entry = entries.get(request.url);
      return Promise.resolve(entry && Date.now() < entry.expiresAt ? entry.response.clone() : undefined);
    }),
    put: vi.fn((request: Request, response: Response) => {
      if (!STORABLE_STATUS_CODES.has(response.status)) {
        return Promise.resolve();
      }

      entries.set(request.url, { response, expiresAt: Date.now() + sharedCacheLifetimeSecondsOf(response) * 1_000 });

      return Promise.resolve();
    }),
  };

  vi.stubGlobal("caches", { default: cache });

  return { entries, match: cache.match, put: cache.put };
}

const request = (url = ENDPOINT_URL) => new Request(url);
const respondingWith = (body: string) => () => Promise.resolve(new Response(body, { status: 200 }));
const failing = () => Promise.resolve(new Response(null, { status: 502 }));
const settleBackgroundPromises = async () => {
  await Promise.all(backgroundPromises);
  backgroundPromises.length = 0;
};

describe("edgeCached", () => {
  test("returns the response from `produce` and stores it on a miss", async () => {
    const { entries } = memoryCache();
    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    await settleBackgroundPromises();

    expect(await response.text()).toBe("first");
    expect(await entries.get(ENDPOINT_URL)?.response.text()).toBe("first");
  });

  test("returns the response from `produce` before the cache finishes storing it", async () => {
    const { put } = memoryCache();
    put.mockReturnValue(new Promise(() => undefined));

    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    expect(await response.text()).toBe("first");
    expect(backgroundPromises).toHaveLength(1);
  });

  test("returns the response from `produce` and logs the failure when the cache rejects it", async () => {
    const { put } = memoryCache();
    put.mockRejectedValue(new Error("Storage full."));

    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    await settleBackgroundPromises();

    expect(response.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ event: "edge_cache_store_failed" }));
  });

  test("returns the response from `produce` and logs the failure when the request cannot be extended", async () => {
    memoryCache();
    extendRequestUntil.mockRejectedValueOnce(new Error("Outside a request."));

    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    expect(await response.text()).toBe("first");
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "edge_cache_store_failed", message: "Outside a request." }),
    );
  });

  test("returns the response from `produce` and logs the failure when the cache cannot be read", async () => {
    const { match } = memoryCache();
    match.mockRejectedValueOnce(new Error("Cache unavailable."));

    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    expect(await response.text()).toBe("first");
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "edge_cache_read_failed", message: "Cache unavailable." }),
    );
  });

  test("sets the `Cache-Control` header's `max-age` of a successful response to the successful response lifetime", async () => {
    const { entries } = memoryCache();

    const response = await edgeCached(request(), LIFETIMES, respondingWith("first"));

    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(entries.get(ENDPOINT_URL)?.response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  test("sets the `Cache-Control` header's `max-age` of a stored successful response to the seconds its stored copy has left", async () => {
    memoryCache();

    await edgeCached(request(), LIFETIMES, respondingWith("first"));
    await settleBackgroundPromises();
    vi.advanceTimersByTime(20_000);

    const response = await edgeCached(request(), LIFETIMES, respondingWith("second"));

    expect(response.headers.get("cache-control")).toBe("public, max-age=40");
    expect([...response.headers.keys()]).toEqual(["cache-control", "content-type"]);
  });

  test("returns the stored response without calling `produce` until the successful response lifetime has passed", async () => {
    memoryCache();

    const produce = vi.fn(respondingWith("second"));

    await edgeCached(request(), LIFETIMES, respondingWith("first"));
    await settleBackgroundPromises();
    vi.advanceTimersByTime(59_000);

    const response = await edgeCached(request(), LIFETIMES, produce);

    expect(await response.text()).toBe("first");
    expect(produce).not.toHaveBeenCalled();
    expect(backgroundPromises).toHaveLength(0);
  });

  test("calls `produce` once the successful response lifetime has passed", async () => {
    memoryCache();

    await edgeCached(request(), LIFETIMES, respondingWith("first"));
    await settleBackgroundPromises();
    vi.advanceTimersByTime(60_000);

    const response = await edgeCached(request(), LIFETIMES, respondingWith("second"));

    expect(await response.text()).toBe("second");
  });

  test("returns a failed response with a `Cache-Control: no-store` header, and stores it with a 200 status code and an `s-maxage` of the failed response lifetime", async () => {
    const { entries } = memoryCache();

    const response = await edgeCached(request(), LIFETIMES, failing);

    await settleBackgroundPromises();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(entries.get(ENDPOINT_URL)?.response.status).toBe(200);
    expect(entries.get(ENDPOINT_URL)?.response.headers.get("cache-control")).toBe("public, s-maxage=30");
  });

  test("returns a stored failed response with its original 502 status code and a `Cache-Control: no-store` header", async () => {
    memoryCache();

    await edgeCached(request(), LIFETIMES, failing);
    await settleBackgroundPromises();

    const response = await edgeCached(request(), LIFETIMES, respondingWith("second"));

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect([...response.headers.keys()]).toEqual(["cache-control"]);
  });

  test("returns the stored failed response without calling `produce` until the failed response lifetime has passed, then calls it", async () => {
    memoryCache();

    const retry = vi.fn(respondingWith("recovered"));

    await edgeCached(request(), LIFETIMES, failing);
    await settleBackgroundPromises();
    vi.advanceTimersByTime(29_000);

    const duringFailedResponseLifetime = await edgeCached(request(), LIFETIMES, retry);

    expect(duringFailedResponseLifetime.status).toBe(502);
    expect(retry).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);

    expect(await (await edgeCached(request(), LIFETIMES, retry)).text()).toBe("recovered");
  });

  test("returns the copy stored for a path to a request for that path with a query string", async () => {
    memoryCache();

    const produce = vi.fn(respondingWith("second"));

    await edgeCached(request(), LIFETIMES, respondingWith("first"));
    await settleBackgroundPromises();

    const response = await edgeCached(request(`${ENDPOINT_URL}?query=1`), LIFETIMES, produce);

    expect(await response.text()).toBe("first");
    expect(produce).not.toHaveBeenCalled();
  });

  test("calls `produce` directly where there is no cache", async () => {
    const produce = vi.fn(respondingWith("uncached"));
    const response = await edgeCached(request(), LIFETIMES, produce);

    expect(await response.text()).toBe("uncached");
    expect(produce).toHaveBeenCalledOnce();
  });
});
