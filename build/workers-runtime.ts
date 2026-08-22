import type { Plugin } from "vite";

const WORKERS_RUNTIME_PREFIX = "cloudflare:";

/**
 * Marks `cloudflare:*` imports as external.
 *
 * These specifiers are provided by the Workers runtime rather than resolved from disk,
 * so they must pass through the bundler unchanged for the deployed worker to resolve.
 */
export function workersRuntimePlugin(): Plugin {
  return {
    name: "kuzmano.ski:workers-runtime",
    enforce: "pre",
    resolveId: (id) => (id.startsWith(WORKERS_RUNTIME_PREFIX) ? { id, external: true } : null),
  };
}
