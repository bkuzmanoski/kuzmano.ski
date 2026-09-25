import type * as cloudflareWorkers from "cloudflare:workers";

let devEnv: Promise<cloudflareWorkers.WorkerEnv> | null = null;

async function proxiedEnv(): Promise<cloudflareWorkers.WorkerEnv> {
  const { getPlatformProxy } = await import("wrangler");
  const { env } = await getPlatformProxy<cloudflareWorkers.WorkerEnv>();

  return env;
}

/**
 * The `cloudflare:workers` module, or `null` outside Workers.
 *
 * `vite dev` runs this module in Node, where that specifier does not resolve, so it is
 * imported dynamically rather than statically.
 */
async function workersModule(): Promise<typeof cloudflareWorkers | null> {
  try {
    return await import("cloudflare:workers");
  } catch {
    return null;
  }
}

/**
 * The bindings this request runs against, wherever it is running. Rejects if there are none.
 *
 * On Workers they come from `cloudflare:workers`. Under `vite dev`, the platform proxy supplies
 * the same bindings instead.
 */
export async function workerEnv(): Promise<cloudflareWorkers.WorkerEnv> {
  const workers = await workersModule();

  if (workers) {
    return workers.env;
  }

  if (!import.meta.env.DEV) {
    throw new Error("`cloudflare:workers` is not available outside of Workers.");
  }

  return (devEnv ??= proxiedEnv().catch((error: unknown) => {
    devEnv = null;
    throw error;
  }));
}

/**
 * Extends the current request until `promise` settles, for work that continues after the response
 * is sent. Outside Workers, the process outlives the request, so `promise` runs to completion
 * without it.
 */
export async function extendRequestUntil(promise: Promise<unknown>): Promise<void> {
  (await workersModule())?.waitUntil(promise);
}
