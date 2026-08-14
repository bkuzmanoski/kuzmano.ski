import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { getRouter } from "#/router";

/** Renders the real route tree at `route`. A load error is left to surface in the render.*/
export function renderRoute(route: string) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const router = getRouter(history);

  return { history, ...render(<RouterProvider router={router} />) };
}
