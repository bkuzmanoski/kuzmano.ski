import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { NotFound } from "#/app/not-found.tsx";

import { routeTree } from "./routeTree.gen.ts";

import type { RouterHistory } from "@tanstack/react-router";

export function getRouter(history?: RouterHistory) {
  const router = createTanStackRouter({
    routeTree,
    history,
    scrollRestoration: false, // The router identifies a scrolled element by its position in the DOM, so it would scroll a window showing a new entry to where the user left the previous entry. Each window keeps its own position instead.
    trailingSlash: "never",
    defaultPreload: "intent",
    defaultPreloadStaleTime: Infinity,
    defaultStaleTime: Infinity,
    defaultNotFoundComponent: NotFound,
    // No `defaultErrorComponent` so errors present an error page rather than showing on the desktop.
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
