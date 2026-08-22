import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { getRouter } from "#/router";
import { Route as rootRoute } from "#/routes/__root";

import type { RootRouteOptions } from "@tanstack/react-router";

// The shell renders the document itself and cannot mount in the testing library's container.
// These tests cover routing, not the document, so the shell is omitted. The cast is needed
// because `options` uses the type shared by all routes rather than the root route's type.
(rootRoute.options as RootRouteOptions).shellComponent = undefined;

/** Renders the real route tree at `route`. A load error is left to surface in the render.*/
export function renderRoute(route: string) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const router = getRouter(history);

  return { history, ...render(<RouterProvider router={router} />) };
}
