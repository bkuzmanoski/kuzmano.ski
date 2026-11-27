import { RouterContextProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import type { ReactElement } from "react";

// Shared empty router providing `<Link>` context without replacing the router or resetting link state across rerenders.
const contextRouter = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });

/**
 * Renders `ui` in router context, for a component that contains links without routing to a match. The context is the
 * testing library's `wrapper`, so `rerender` renders in the same context.
 *
 * Note: Where a link leads is covered by the suites using `renderRoute` from `./router`, which mounts the real route
 * tree.
 */
export const renderInRouterContext = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => <RouterContextProvider router={contextRouter}>{children}</RouterContextProvider>,
  });
