import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { collections } from "#/content";

import { CollectionEntryList, EMPTY_COLLECTION_MESSAGE } from "./collection-entry-list";

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager-mock")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/ui", () => ({
  playClick: vi.fn(),
  playHover,
  skipScrollAbove,
  scrollSafeClickSoundHandlers,
}));

const open = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());
const skipScrollAbove = vi.hoisted(() => vi.fn());
const scrollSafeClickSoundHandlers = vi.hoisted(() => ({ onPointerDown: vi.fn(), onPointerUp: vi.fn() }));

const collection = collections["tech-notes"]!;
const entries = collection.list();
const lastIndex = entries.length - 1;

const routeOf = (index: number) => `/tech-notes/${entries[index]!.slug}`;

if (entries.length < 2) {
  throw new Error("This suite expects at least two `tech-notes` entries.");
}

beforeEach(() => {
  open.mockClear();
  playHover.mockClear();
  skipScrollAbove.mockClear();
  scrollSafeClickSoundHandlers.onPointerDown.mockClear();
  scrollSafeClickSoundHandlers.onPointerUp.mockClear();
});

function renderList(activeSlug: string | null) {
  render(<CollectionEntryList activeSlug={activeSlug} route="/tech-notes" collection={collection} />);
  return screen.getAllByRole("link");
}

test("a collection with no entries show an empty state", () => {
  render(<CollectionEntryList activeSlug={null} route="/tech-notes" collection={{ ...collection, list: () => [] }} />);

  expect(screen.getByText(EMPTY_COLLECTION_MESSAGE)).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();
});

test("the list is a single tab stop, on the active entry", () => {
  const links = renderList(entries[lastIndex]!.slug);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
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

test("a key that moves the focus sounds a detent", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });
  expect(playHover).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(links[1]!, { key: "End" });
  expect(playHover).toHaveBeenCalledTimes(2);
});

test("a key that runs into the end of the list sounds nothing", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowUp" });
  fireEvent.keyDown(links[0]!, { key: "Home" });

  expect(playHover).not.toHaveBeenCalled();
});

test("the scroll the focus causes is not sounded as travel", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });
  expect(skipScrollAbove).toHaveBeenCalledWith(links[1]);
});

test("the focus makes the entry it lands on the tab stop", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.focus(links.at(-1)!);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
});

test("enter and space open the entry that holds the focus", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.keyDown(links[1]!, { key: "Enter" });
  expect(open).toHaveBeenLastCalledWith(routeOf(1));

  fireEvent.keyDown(links.at(-1)!, { key: " " });
  expect(open).toHaveBeenLastCalledWith(routeOf(lastIndex));
});

test("an entry sounds its press through both halves of a pointer press", () => {
  const links = renderList(entries[0]!.slug);

  fireEvent.pointerDown(links[1]!);
  fireEvent.pointerUp(links[1]!);

  expect(scrollSafeClickSoundHandlers.onPointerDown).toHaveBeenCalled();
  expect(scrollSafeClickSoundHandlers.onPointerUp).toHaveBeenCalled();
});

test("a press opens the entry without leaving the page", () => {
  const links = renderList(entries[0]!.slug);
  const click = fireEvent.click(links[1]!);

  expect(click).toBe(false); // The default was prevented.
  expect(open).toHaveBeenCalledWith(routeOf(1));
});

test("a modified press is handled by the browser so the entry opens in a new tab", () => {
  const links = renderList(entries[0]!.slug);

  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
    expect(fireEvent.click(links[1]!, modifier)).toBe(true);
  }

  expect(fireEvent.click(links[1]!, { button: 1 })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});
