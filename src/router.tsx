import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { ErrorView } from "#/views/error-view";
import { NotFound } from "#/views/not-found";

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
    defaultErrorComponent: ErrorView,
    defaultNotFoundComponent: NotFound,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
