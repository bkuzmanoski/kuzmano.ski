import type { WorkerEnv } from "cloudflare:workers";

let devEnv: Promise<WorkerEnv> | null = null;

async function proxiedEnv(): Promise<WorkerEnv> {
  const { getPlatformProxy } = await import("wrangler");
  const { env } = await getPlatformProxy<WorkerEnv>();

  return env;
}

/**
 * The bindings this request runs against, wherever it is running. Rejects if there are none.
 *
 * On Workers they come from `cloudflare:workers`. `vite dev` runs this module in Node, where
 * that specifier does not resolve, so the platform proxy supplies the same bindings instead.
 */
export async function workerEnv(): Promise<WorkerEnv> {
  try {
    return (await import("cloudflare:workers")).env;
  } catch {
    if (!import.meta.env.DEV) {
      throw new Error("`cloudflare:workers` is not available outside of Workers.");
    }

    return (devEnv ??= proxiedEnv().catch((error: unknown) => {
      devEnv = null;
      throw error;
    }));
  }
}
