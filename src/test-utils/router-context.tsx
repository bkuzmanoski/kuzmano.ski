import { RouterContextProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";

import type { ReactNode } from "react";

// Provides the router context that `<Link>` needs to build its href. It has no route tree because
// these tests render links without testing where they lead. Keep it shared so rerenders do not
// replace the router and reset the state the links read.
const contextRouter = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });

/**
 * Provides router context for a component that contains links without routing to a match.
 *
 * Pass this as the testing library's `wrapper` so the same context is used across rerenders.
 *
 * Note: Where a link leads is covered by the suites using `renderRoute` from `./router`,
 * which mounts the real route tree.
 */
export const RouterContext = ({ children }: { children: ReactNode }) => (
  <RouterContextProvider router={contextRouter}>{children}</RouterContextProvider>
);
