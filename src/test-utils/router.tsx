import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { getRouter } from "#/router";
import { Route as rootRoute } from "#/routes/__root";

import type { RootRouteOptions } from "@tanstack/react-router";

// The shell renders the document itself and cannot mount in the testing library's container.
// These tests cover routing, not the document, so the shell is omitted. The cast is needed
// because `options` uses the type shared by all routes rather than the root route's type.
(rootRoute.options as RootRouteOptions).shellComponent = undefined;

/**
 * Renders the real route tree at `route`. A load error is left to surface in the render.
 *
 * Mounting the tree pulls in every route module, and with them the desktop, so a suite that mocks
 * a module the desktop reads has to mock all of it. A suite that renders one component and needs
 * nothing more than a router for its links to read should use `RouterContext` from
 * `./router-context`, which holds no routes.
 */
export function renderRoute(route: string) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const router = getRouter(history);

  return { history, ...render(<RouterProvider router={router} />) };
}
