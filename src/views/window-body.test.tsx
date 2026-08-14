import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { collections } from "#/content";
import { NOT_FOUND_TITLE } from "#/content/window-registry";
import { newestEntry } from "#/test-utils/content";

import { WindowBody } from "./window-body";

const openWindows = vi.hoisted(() => vi.fn<() => { entry?: { route: string; title: string } }>(() => ({})));

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager-mock")).windowManagerMock({ content: openWindows }),
);
vi.mock("#/lib/audio/ui", () => ({
  playClick: vi.fn(),
  playHover: vi.fn(),
  skipScrollAbove: vi.fn(),
  scrollSafeClickSoundHandlers: {},
}));

const entry = newestEntry("tech-notes");

test("a collection route renders a link for every entry in the collection", () => {
  render(<WindowBody route="/tech-notes" />);

  expect(screen.getAllByRole("link")).toHaveLength(collections["tech-notes"]!.list().length);
  expect(screen.getByRole("link", { name: entry.title })).toBeDefined();
});

test("the entry list marks the entry the entry window is showing, and only in the collection it belongs to", () => {
  openWindows.mockReturnValue({ entry: { route: `/tech-notes/${entry.slug}`, title: entry.title } });

  const { container, rerender } = render(<WindowBody route="/tech-notes" />);

  expect(screen.getByRole("link", { name: entry.title }).getAttribute("aria-current")).toBe("true");

  rerender(<WindowBody route="/design-notes" />);

  expect(container.querySelector("[aria-current]")).toBeNull();
});

test("an entry route suspends on its body chunk, from a collection or the top-level pages", () => {
  const { rerender } = render(<WindowBody route={`/tech-notes/${entry.slug}`} />);

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined(); // The body arrives in a chunk of its own.

  rerender(<WindowBody route="/about" />);

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
});

test("a route that matches no content renders the not-found body", () => {
  render(<WindowBody route="/no-such-page" />);
  expect(screen.getByRole("heading", { name: NOT_FOUND_TITLE })).toBeDefined();
});
