import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { testCollection } from "#/test-utils/content";

import { CollectionEntryList, EMPTY_COLLECTION_MESSAGE } from "./collection-entry-list";

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playHover, scrollSafeClickSoundHandlers }),
);
vi.mock("#/lib/audio/scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

const open = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());
const scrollIntoViewSilently = vi.hoisted(() => vi.fn());
const scrollSafeClickSoundHandlers = vi.hoisted(() => ({ onPointerDown: vi.fn(), onPointerUp: vi.fn() }));

const { collection, entries, routeOf } = testCollection("tech-notes", 2);
const lastIndex = entries.length - 1;

beforeEach(() => {
  open.mockClear();
  playHover.mockClear();
  scrollIntoViewSilently.mockClear();
  scrollSafeClickSoundHandlers.onPointerDown.mockClear();
  scrollSafeClickSoundHandlers.onPointerUp.mockClear();
});

function renderList(activeSlug: string | null) {
  render(<CollectionEntryList activeSlug={activeSlug} collection={collection} />);
  return screen.getAllByRole("link");
}

test("a collection with no entries show an empty state", () => {
  render(<CollectionEntryList activeSlug={null} collection={{ ...collection, list: () => [] }} />);

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

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
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

test("a press on a partly visible entry takes over the browser's own focus-scroll", () => {
  const links = renderList(entries[0]!.slug);

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the active entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, { button: 0 })).toBe(false); // The default was prevented.
  expect(document.activeElement).toBe(links[1]);
  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
});

test.each([
  ["a command press", { metaKey: true }],
  ["a control press", { ctrlKey: true }],
  ["a shift press", { shiftKey: true }],
  ["an option press", { altKey: true }],
  ["a middle press", { button: 1 }],
])("%s opens the link in the background, leaving the list's focus and scroll unchanged", (_name, press) => {
  const links = renderList(entries[0]!.slug);
  const focus = vi.spyOn(links[1]!, "focus");

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the active entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, press)).toBe(false); // Only the native focus is prevented, not the link's own click.
  expect(focus).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(links[1]);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
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
