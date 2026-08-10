import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { collections } from "#/content";

import { CollectionEntryList } from "./collection-entry-list";

const open = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager-mock")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/ui", () => ({ playClick: () => {} }));

const collection = collections["design-notes"]!;
const entries = collection.list();
const routeOf = (index: number) => `/design-notes/${entries[index]!.slug}`;

beforeEach(() => {
  open.mockClear();
});

function renderList(activeSlug: string | null) {
  render(<CollectionEntryList activeSlug={activeSlug} basePath="/design-notes" collection={collection} />);
  return screen.getAllByRole("link");
}

test("the list is a single tab stop, on the active entry", () => {
  const links = renderList(entries[2]!.slug);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links[2]]);
});

test("the tab stop falls on the first entry when none is active", () => {
  const links = renderList(null);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links[0]]);
});

test("the arrow keys move the focus along the list", () => {
  const links = renderList(entries[0]!.slug);

  links[0]!.focus();
  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(links[1]);

  fireEvent.keyDown(links[1]!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(links[0]);
});

test("home and end reach the ends of the list, and the arrow keys stop there", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "End" });
  expect(document.activeElement).toBe(links.at(-1));

  fireEvent.keyDown(links.at(-1)!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(links.at(-1));

  fireEvent.keyDown(links.at(-1)!, { key: "Home" });
  expect(document.activeElement).toBe(links[0]);

  fireEvent.keyDown(links[0]!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(links[0]);
});

test("the focus makes the entry it lands on the tab stop", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.focus(links[3]!);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links[3]]);
});

test("enter and space open the entry that holds the focus", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[1]!, { key: "Enter" });
  expect(open).toHaveBeenLastCalledWith(routeOf(1));

  fireEvent.keyDown(links[2]!, { key: " " });
  expect(open).toHaveBeenLastCalledWith(routeOf(2));
});

test("a press opens the entry without leaving the page", () => {
  const links = renderList(entries[0]!.slug);
  const click = fireEvent.click(links[1]!);

  expect(click).toBe(false); // The default was prevented.
  expect(open).toHaveBeenCalledWith(routeOf(1));
});
