import { RouterContextProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import type { ReactElement } from "react";

// Provides the router context that `<Link>` needs to build its href. It has no route tree because
// these tests render links without testing where they lead. Keep it shared so rerenders do not
// replace the router and reset the state the links read.
const contextRouter = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });

/**
 * Renders `ui` in router context, for a component that contains links without routing to a match.
 * The context is the testing library's `wrapper`, so `rerender` renders in the same context.
 *
 * Note: Where a link leads is covered by the suites using `renderRoute` from `./router`,
 * which mounts the real route tree.
 */
export const renderInRouterContext = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => <RouterContextProvider router={contextRouter}>{children}</RouterContextProvider>,
  });
