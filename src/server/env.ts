import type * as cloudflareWorkers from "cloudflare:workers";

let devEnv: Promise<cloudflareWorkers.WorkerEnv> | null = null;

async function proxiedEnv(): Promise<cloudflareWorkers.WorkerEnv> {
  const { getPlatformProxy } = await import("wrangler");
  const { env } = await getPlatformProxy<cloudflareWorkers.WorkerEnv>();

  return env;
}

// Dynamically imports `cloudflare:workers`, returning `null` outside Workers (`vite dev` runs in Node where that
// specifier does not resolve).
async function workersModule(): Promise<typeof cloudflareWorkers | null> {
  try {
    return await import("cloudflare:workers");
  } catch {
    return null;
  }
}

/**
 * Returns the Worker bindings for the current environment, rejecting if unavailable.
 *
 * Uses `cloudflare:workers` on Workers and the platform proxy under `vite dev`.
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
 * Extends the current request until `promise` settles, for work that continues after the response is sent. Outside
 * Workers, the process outlives the request, so `promise` runs to completion without it.
 */
export async function extendRequestUntil(promise: Promise<unknown>): Promise<void> {
  (await workersModule())?.waitUntil(promise);
}
