import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { NotFoundPage } from "#/views/not-found";

import { routeTree } from "./routeTree.gen";

import type { RouterHistory } from "@tanstack/react-router";

export function getRouter(history?: RouterHistory) {
  const router = createTanStackRouter({
    routeTree,
    history,
    scrollRestoration: true,
    trailingSlash: "never",
    defaultPreload: "intent",
    defaultPreloadStaleTime: Infinity,
    defaultStaleTime: Infinity,
    defaultNotFoundComponent: NotFoundPage,
    // No `defaultErrorComponent` so errors present an error page rather than showing on the desktop.
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
