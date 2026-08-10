import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { getRouter } from "#/router";

/** Renders the real route tree at `path`. A load error is left to surface in the render. */
export async function renderRoute(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = getRouter(history);

  await router.load().catch(() => undefined);

  return { history, ...render(<RouterProvider router={router} />) };
}
