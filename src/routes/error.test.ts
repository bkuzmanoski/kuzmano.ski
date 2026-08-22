import { screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type * as Content from "#/content";
import { renderRoute } from "#/test-utils/router";

// Content that cannot be read fails when the route loads, and again when the desktop
// resolves the window for it. The desktop cannot recover from this. These tests use
// the real route tree to cover that path.

vi.mock("#/content", async (importOriginal) => {
  const actual = await importOriginal<typeof Content>();
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

test("an error replaces the desktop with a standalone page", async () => {
  renderRoute("/about");

  expect(await screen.findByText("There was a problem loading this page.")).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Main menu" })).toBeNull();
  expect(screen.queryByRole("region")).toBeNull();
  expect(sendBeacon).toHaveBeenCalledWith("/api/client-errors", expect.any(Blob));
});
