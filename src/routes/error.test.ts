import { screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { API } from "#/api.ts";
import type * as Catalog from "#/site/catalog.ts";
import { renderRoute } from "#/test-utils/router.tsx";

// Content that cannot be read fails when the route loads, and again when the desktop
// resolves the window for it. The desktop cannot recover from this. These tests use
// the real route tree to cover that path.

vi.mock("#/site/catalog.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof Catalog>();
  return {
    ...actual,
    pages: {
      ...actual.pages,
      frontmatterOf: () => {
        throw new Error("Unreadable frontmatter.");
      },
    },
  };
});

const sendBeacon = vi.fn(() => true);

beforeEach(() => {
  navigator.sendBeacon = sendBeacon;

  // The throw above is the subject of the test, so the reports by React and the router are expected output.
  vi.spyOn(console, "error").mockReturnValue();
  vi.spyOn(console, "warn").mockReturnValue();
});

test("a route that throws while loading renders the error page in place of the desktop", async () => {
  renderRoute("/about");

  expect(await screen.findByText("There was a problem loading this page.")).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Main menu" })).toBeNull();
  expect(screen.queryByRole("region")).toBeNull();
});

test("a route that throws while loading posts a client error report", async () => {
  renderRoute("/about");
  await screen.findByText("There was a problem loading this page.");

  expect(sendBeacon).toHaveBeenCalledWith(API.clientErrors, expect.any(Blob));
});
