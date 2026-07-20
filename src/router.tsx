import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

import type { RouterHistory } from "@tanstack/react-router";

/** `history` is only passed by tests, which drive the router from memory. */
export function getRouter(history?: RouterHistory) {
  const router = createTanStackRouter({
    routeTree,
    history,
    scrollRestoration: true,
    trailingSlash: "never",
    defaultPreload: "intent",
    // Content is baked in at build time, so loader results never go stale between deploys
    defaultPreloadStaleTime: Infinity,
    defaultStaleTime: Infinity,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
