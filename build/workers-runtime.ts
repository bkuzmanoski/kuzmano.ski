import type { Plugin } from "vite";

const WORKERS_RUNTIME_PREFIX = "cloudflare:";

/**
 * Externalizes `cloudflare:*` imports so the Workers runtime can resolve them at runtime.
 *
 * Without this plugin, Vite's dev-server dependency scan attempts to resolve
 * `import("cloudflare:workers")` in `/src/server/env.ts`. That failure emits a warning
 * and prevents dependency pre-bundling for the project, slowing down the dev server.
 */
export function workersRuntimePlugin(): Plugin {
  return {
    name: "kuzmano.ski:workers-runtime",
    enforce: "pre",
    resolveId: (id) => (id.startsWith(WORKERS_RUNTIME_PREFIX) ? { id, external: true } : null),
  };
}
