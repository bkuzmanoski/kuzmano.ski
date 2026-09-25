import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds.ts";
import { EntryCoverImagesContext } from "#/lib/content/entry-cover-images.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { WindowKeyDownContext, createWindowKeyDownHandlers } from "#/lib/window-manager/use-window-key-down.ts";
import { fakeCollection, fakeCollectionEntries, fakeCoverImage, fakeEntry } from "#/test-utils/collection.ts";

import { CollectionEntryList, EMPTY_COLLECTION_MESSAGE } from "./collection-entry-list.tsx";

vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playHover }),
);
vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

const open = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());
const scrollIntoViewSilently = vi.hoisted(() => vi.fn());

const collectionEntries = fakeCollectionEntries("newest", "middle", "oldest");
const collection = fakeCollection(collectionEntries);
const lastIndex = collectionEntries.length - 1;
const routeOf = (index: number) => collection.routeOf(collectionEntries[index]!.slug);

beforeEach(() => {
  open.mockClear();
  playHover.mockClear();
  scrollIntoViewSilently.mockClear();
  vi.mocked(playClick).mockClear();
});

function renderList(activeSlug: string | null) {
  render(<CollectionEntryList activeSlug={activeSlug} collection={collection} />);
  return screen.getAllByRole("link");
}

// The part of `Window` the list registers with, repeated here so the suite does not render the window's chrome.
function renderListInWindow(activeSlug: string | null) {
  const keyDownHandlers = createWindowKeyDownHandlers();

  render(
    <section tabIndex={0} aria-label="Window" onKeyDown={keyDownHandlers.handle}>
      <WindowKeyDownContext value={keyDownHandlers}>
        <CollectionEntryList activeSlug={activeSlug} collection={collection} />
      </WindowKeyDownContext>
    </section>,
  );

  return { windowRegion: screen.getByRole("region"), links: screen.getAllByRole("link") };
}

function renderEntryWithCoverImage(slug: string, coverImage: CoverImage) {
  const collectionWithCoverImage = fakeCollection([fakeEntry(slug)]);
  return render(
    <EntryCoverImagesContext value={{ [collectionWithCoverImage.entryKeyOf(slug)]: coverImage }}>
      <CollectionEntryList activeSlug={null} collection={collectionWithCoverImage} />
    </EntryCoverImagesContext>,
  );
}

test("an entry with a cover image shows its thumbnail, with a `<source>` for each alternate format", () => {
  const coverImage = fakeCoverImage("newest");
  const { container } = renderEntryWithCoverImage("newest", coverImage);
  const image = container.querySelector("img");

  expect(image?.getAttribute("src")).toBe(coverImage.thumbnail.src);
  expect([...container.querySelectorAll("source")].map((source) => source.getAttribute("srcset"))).toEqual(
    coverImage.thumbnail.alternates.map(({ srcSet }) => srcSet),
  );
});

test("the cover image thumbnail does not contribute to the entry link's accessible name", () => {
  const { container } = renderEntryWithCoverImage("newest", fakeCoverImage("newest"));

  expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  expect(screen.getByRole("link").getAttribute("aria-label")).toBe("newest");
});

test("an entry without a cover image shows the placeholder glyph in place of a thumbnail", () => {
  const { container } = render(
    <CollectionEntryList activeSlug={null} collection={fakeCollection([fakeEntry("newest")])} />,
  );

  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});

test("a collection without entries shows the empty collection message instead of a list", () => {
  render(<CollectionEntryList activeSlug={null} collection={{ ...collection, list: () => [] }} />);

  expect(screen.getByText(EMPTY_COLLECTION_MESSAGE)).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();
});

test("the list is a single tab stop, on the active entry", () => {
  const links = renderList(collectionEntries[lastIndex]!.slug);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
});

test("the tab stop falls on the first entry when none is active", () => {
  const links = renderList(null);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links[0]]);
});

test("the arrow keys move the focus along the list", () => {
  const links = renderList(collectionEntries[0]!.slug);

  links[0]!.focus();
  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(links[1]);

  fireEvent.keyDown(links[1]!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(links[0]);
});

test("the Home and End keys move the focus to the ends of the list, and the arrow keys stop there", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "End" });

  expect(document.activeElement).toBe(links.at(-1));

  fireEvent.keyDown(links.at(-1)!, { key: "ArrowDown" });

  expect(document.activeElement).toBe(links.at(-1));

  fireEvent.keyDown(links.at(-1)!, { key: "Home" });

  expect(document.activeElement).toBe(links[0]);

  fireEvent.keyDown(links[0]!, { key: "ArrowUp" });

  expect(document.activeElement).toBe(links[0]);
});

test("a key that moves the focus plays a detent", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(playHover).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(links[1]!, { key: "End" });

  expect(playHover).toHaveBeenCalledTimes(2);
});

test("a key that does not move the focus at an end of the list does not play a detent", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowUp" });
  fireEvent.keyDown(links[0]!, { key: "Home" });

  expect(playHover).not.toHaveBeenCalled();
});

test("pressing the Down arrow key while the window itself has the focus focuses the first entry, plays the hover sound, and prevents the key's default action", () => {
  const { windowRegion, links } = renderListInWindow(collectionEntries[lastIndex]!.slug);

  windowRegion.focus();

  expect(fireEvent.keyDown(windowRegion, { key: "ArrowDown" })).toBe(false);
  expect(document.activeElement).toBe(links[0]);
  expect(playHover).toHaveBeenCalledTimes(1);
});

test("moving the focus scrolls the focused entry into view silently", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
});

test("focusing an entry makes it the tab stop", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.focus(links.at(-1)!);

  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
});

test("the Enter and Space keys open the focused entry", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.keyDown(links[1]!, { key: "Enter" });

  expect(open).toHaveBeenLastCalledWith(routeOf(1));

  fireEvent.keyDown(links.at(-1)!, { key: " " });

  expect(open).toHaveBeenLastCalledWith(routeOf(lastIndex));
});

test("pressing an entry with the mouse plays a click sound", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.pointerDown(links[1]!, { pointerType: "mouse" });

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a tap plays a click sound on release, but not when it is canceled by scrolling", () => {
  const links = renderList(collectionEntries[0]!.slug);

  fireEvent.pointerDown(links[1]!, { pointerType: "touch" });

  expect(playClick).not.toHaveBeenCalled();

  fireEvent.pointerUp(links[1]!, { pointerType: "touch" });

  expect(playClick).toHaveBeenCalledTimes(1);

  fireEvent.pointerDown(links[2]!, { pointerType: "touch" });
  fireEvent.pointerCancel(links[2]!, { pointerType: "touch" });

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press on an entry prevents the native focus, then focuses the entry and scrolls it into view silently", () => {
  const links = renderList(collectionEntries[0]!.slug);

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the active entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, { button: 0 })).toBe(false); // The default behavior was prevented.
  expect(document.activeElement).toBe(links[1]);
  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
});

test.each([
  ["a press with the Command key", { metaKey: true }],
  ["a press with the Control key", { ctrlKey: true }],
  ["a press with the Shift key", { shiftKey: true }],
  ["a press with the Option key", { altKey: true }],
  ["a middle press", { button: 1 }],
])("%s does not change the list's focus or scroll", (_name, press) => {
  const links = renderList(collectionEntries[0]!.slug);
  const focus = vi.spyOn(links[1]!, "focus");

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the active entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, press)).toBe(false); // Only the native focus is prevented, not the link's own click.
  expect(focus).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(links[1]);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("a press opens the entry rather than following the link", () => {
  const links = renderList(collectionEntries[0]!.slug);
  const click = fireEvent.click(links[1]!);

  expect(click).toBe(false); // The default behavior was prevented.
  expect(open).toHaveBeenCalledWith(routeOf(1));
});

test("a modified or middle press follows the link rather than opening the entry", () => {
  const links = renderList(collectionEntries[0]!.slug);

  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
    expect(fireEvent.click(links[1]!, modifier)).toBe(true);
  }

  expect(fireEvent.click(links[1]!, { button: 1 })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});
