import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type * as Content from "#/content";
import { getRouter } from "#/router";

/* Content that cannot be read fails when the route loads, and again when the desktop
 * resolves the window for it. The desktop cannot recover from this. These tests use
 * the real route tree to cover that path. */

vi.mock("#/content", async (importOriginal) => {
  const actual = await importOriginal<typeof Content>();

  return {
    ...actual,
    pages: {
      ...actual.pages,
      frontmatter: () => {
        throw new Error("Unreadable frontmatter.");
      },
    },
  };
});

test("an error replaces the desktop with a standalone page", async () => {
  const router = getRouter(createMemoryHistory({ initialEntries: ["/about"] }));

  await router.load().catch(() => undefined);

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Error" })).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Main menu" })).toBeNull();
  expect(screen.queryByRole("region")).toBeNull();
});
