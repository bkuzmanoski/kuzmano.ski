import { act, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { testCollection } from "#/test-utils/content";

import { WindowBody } from "./window-body";

const openWindows = vi.hoisted(() => vi.fn<() => { entry?: { route: string; title: string } }>(() => ({})));

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({ content: openWindows }),
);
vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);
vi.mock("#/lib/audio/scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

const { entries } = testCollection("tech-notes");
const entry = entries[0]!;

test("a collection route renders a link for every entry in the collection", () => {
  render(<WindowBody route="/tech-notes" />);

  expect(screen.getAllByRole("link")).toHaveLength(entries.length);
  expect(screen.getByRole("link", { name: entry.title })).toBeDefined();
});

test("the entry list marks the entry the entry window is showing, and only in the collection it belongs to", () => {
  openWindows.mockReturnValue({ entry: { route: `/tech-notes/${entry.slug}`, title: entry.title } });

  const { container, rerender } = render(<WindowBody route="/tech-notes" />);

  expect(screen.getByRole("link", { name: entry.title }).getAttribute("aria-current")).toBe("true");

  rerender(<WindowBody route="/design-notes" />);

  expect(container.querySelector("[aria-current]")).toBeNull();
});

test("an entry route suspends on its body chunk, from a collection or the top-level pages", async () => {
  const mounted = act(() => render(<WindowBody route={`/tech-notes/${entry.slug}`} />));

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined(); // The body arrives in a chunk of its own.

  const { rerender } = await mounted;
  const rerendered = act(() => {
    rerender(<WindowBody route="/about" />);
    return null;
  });

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();

  await rerendered;
});

test("a route that does not match any content renders an empty window body", () => {
  const { container } = render(<WindowBody route="/no-such-page" />);
  expect(container.innerHTML).toBe("");
});
