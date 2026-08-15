import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { getRouter } from "#/router";
import { Route as rootRoute } from "#/routes/__root";

import type { RootRouteOptions } from "@tanstack/react-router";

// The shell renders the document itself, which cannot mount inside the container Testing Library
// renders into. These tests cover routing rather than the document, so the shell is dropped. The
// cast is for `options`, which is typed as the options every route shares, not the root's own.
(rootRoute.options as RootRouteOptions).shellComponent = undefined;

/** Renders the real route tree at `route`. A load error is left to surface in the render.*/
export function renderRoute(route: string) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const router = getRouter(history);

  return { history, ...render(<RouterProvider router={router} />) };
}
