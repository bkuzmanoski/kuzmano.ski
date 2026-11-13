import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { DEFAULT_ACTIVATION_FLASH_DURATION_MS } from "#/lib/hooks/use-activation-flash.ts";
import { WindowKeyDownContext, createWindowKeyDownHandlers } from "#/lib/window-manager/use-window-key-down.ts";
import { ZoomRectContext } from "#/lib/window-manager/use-zoom-rect.ts";
import type { Collection } from "#/site/catalog.ts";
import {
  collection as COLLECTION,
  collectionEntries as COLLECTION_ENTRIES,
  collectionWithFeed as COLLECTION_WITH_FEED,
} from "#/test-utils/catalog.ts";
import { fakeCollection, fakeEntry } from "#/test-utils/collection.ts";
import { runActivationFlash } from "#/test-utils/menu.ts";
import { SCREEN_READER_ACTIVATIONS, pressWithMouse } from "#/test-utils/press.ts";
import { renderInRouterContext } from "#/test-utils/router-context.tsx";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import styles from "./collection-body.module.css";
import { CollectionBody, CollectionColumnHeadings, UNCATEGORIZED_LABEL } from "./collection-body.tsx";

vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());
vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({ actions: { open }, content: openWindows }),
);
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playHoverSound }),
);
vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

const open = vi.hoisted(() => vi.fn());
const openWindows = vi.hoisted(() => vi.fn<() => { entry?: { route: string; title: string } }>(() => ({})));
const playHoverSound = vi.hoisted(() => vi.fn());
const scrollIntoViewSilently = vi.hoisted(() => vi.fn());

beforeEach(() => {
  open.mockClear();
  openWindows.mockReset();
  openWindows.mockReturnValue({});
  playHoverSound.mockClear();
  scrollIntoViewSilently.mockClear();
  vi.mocked(playClickSound).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const LAST_INDEX = COLLECTION_ENTRIES.length - 1;

const routeOf = (index: number) => COLLECTION.routeOf(COLLECTION_ENTRIES[index]!.slug);
const targetOf = (collection: Collection) => ({ id: "collection" as const, title: collection.title, collection });
const highlightOf = (link: HTMLElement) =>
  link.classList.contains(styles.highlighted) ? "on" : link.classList.contains(styles.unhighlighted) ? "off" : null;
const shownCategoryLabelOf = (row: Element) => row.querySelector("[id$='-category']")?.textContent;

function showEntryInWindow(slug: string | null) {
  openWindows.mockReturnValue(slug === null ? {} : { entry: { route: COLLECTION.routeOf(slug), title: slug } });
}

function renderList(openSlug: string | null) {
  showEntryInWindow(openSlug);
  render(<CollectionBody target={targetOf(COLLECTION)} />);
  return screen.getAllByRole("link");
}

/** The part of `Window` the list registers with, repeated here so the suite does not render the window's chrome. */
function renderListInWindow(openSlug: string | null) {
  showEntryInWindow(openSlug);

  const keyDownHandlers = createWindowKeyDownHandlers();

  render(
    <section tabIndex={0} aria-label="Window" onKeyDown={keyDownHandlers.handle}>
      <WindowKeyDownContext value={keyDownHandlers}>
        <CollectionBody target={targetOf(COLLECTION)} />
      </WindowKeyDownContext>
    </section>,
  );

  return { windowRegion: screen.getByRole("region"), links: screen.getAllByRole("link") };
}

test("an entry shows its category, or `Uncategorized` when its frontmatter omits one, and omits its description", () => {
  const categorizedCollection = fakeCollection([
    fakeEntry("categorized", { description: "A description.", category: "Category" }),
    fakeEntry("uncategorized", { description: "Another description." }),
  ]);

  render(<CollectionBody target={targetOf(categorizedCollection)} />);

  const [categorizedRow, uncategorizedRow] = screen.getAllByRole("link");

  expect(shownCategoryLabelOf(categorizedRow!)).toBe("Category");
  expect(categorizedRow?.textContent).not.toContain("A description.");
  expect(shownCategoryLabelOf(uncategorizedRow!)).toBe(UNCATEGORIZED_LABEL);
  expect(uncategorizedRow?.textContent).not.toContain("Another description.");
});

test("the column headings and each entry render every label of the category column once", () => {
  const collection = fakeCollection([
    fakeEntry("entry-1", { category: "A category" }),
    fakeEntry("entry-2", { category: "Another category" }),
    fakeEntry("entry-3"),
  ]); // The cells stack the labels in one grid area, so every cell sizes the column to the longest label.
  const { container: columnHeadings } = render(<CollectionColumnHeadings collection={collection} />);

  render(<CollectionBody target={targetOf(collection)} />);

  for (const row of [columnHeadings, ...screen.getAllByRole("link")]) {
    for (const label of ["Category", "A category", "Another category", UNCATEGORIZED_LABEL]) {
      expect(within(row).getAllByText(label)).toHaveLength(1);
    }
  }
});

test("the `lang` attribute of an entry's date names the browser's locale when its language differs from that of the document", () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
  renderList(null);

  expect(document.querySelector("time")?.getAttribute("lang")).toBe("de-DE");
});

test("the open entry has the `aria-current` attribute and renders a different icon from the other entries", () => {
  const [openLink, otherLink] = renderList(COLLECTION_ENTRIES[0]!.slug);

  expect(openLink?.getAttribute("aria-current")).toBe("true");
  expect(otherLink?.hasAttribute("aria-current")).toBe(false);
  expect(openLink?.querySelector("svg")?.innerHTML).not.toBe(otherLink?.querySelector("svg")?.innerHTML);
});

test("the list replaces the document icon of an entry with an entry icon by setting the `--collection-body-entry-icon-image` custom property to a `url()` of the entry icon's URL, and renders the document icon for an entry without an entry icon", () => {
  const entryIconUrl = "/media/collection/with-icon.icon.svg";
  const collection = fakeCollection([fakeEntry("with-icon"), fakeEntry("without-icon")], {
    entryIconUrlOf: (slug) => (slug === "with-icon" ? entryIconUrl : null),
  });

  render(<CollectionBody target={targetOf(collection)} />);

  const [rowWithIcon, rowWithoutIcon] = screen.getAllByRole("link");
  const entryIcon = rowWithIcon?.querySelector<HTMLElement>("[style]");

  expect(entryIcon?.style.getPropertyValue("--collection-body-entry-icon-image")).toBe(`url("${entryIconUrl}")`);
  expect(rowWithIcon?.querySelector("svg")).toBeNull();
  expect(rowWithoutIcon?.querySelector("svg")).not.toBeNull();
  expect(rowWithoutIcon?.querySelector("[style]")).toBeNull();
});

test("a categorized entry's link is named by its title and described by its category and date", () => {
  render(<CollectionBody target={targetOf(fakeCollection([fakeEntry("entry", { category: "Category" })]))} />);
  expect(screen.getByRole("link", { name: "entry", description: /^Category \S/ })).toBeDefined();
});

test("an uncategorized entry's link is named by its title and described by its date", () => {
  render(<CollectionBody target={targetOf(fakeCollection([fakeEntry("entry")]))} />);
  expect(screen.getByRole("link", { name: "entry", description: /^\S/ })).toBeDefined();
  expect(screen.queryByRole("link", { description: new RegExp(UNCATEGORIZED_LABEL) })).toBeNull();
});

test("the list sets the `role` attribute to `list`, and each entry's link hides its contents from assistive technology", () => {
  const [link] = renderList(null);

  expect(screen.getByRole("list").getAttribute("role")).toBe("list");
  expect([...link!.children].every((cell) => cell.getAttribute("aria-hidden") === "true")).toBe(true);
});

test("the column headings are hidden from assistive technology", () => {
  render(<CollectionColumnHeadings collection={COLLECTION} />);
  expect(screen.getByText("Title").closest("[aria-hidden='true']")).not.toBeNull();
});

test("the column headings render `null` for a collection without entries", () => {
  const { container } = render(<CollectionColumnHeadings collection={{ ...COLLECTION, list: () => [] }} />);
  expect(container.firstChild).toBeNull();
});

test("a collection without entries shows a link to its feed, which opens in a new tab, instead of a list", () => {
  renderInRouterContext(<CollectionBody target={targetOf({ ...COLLECTION_WITH_FEED, list: () => [] })} />);

  const feedLink = screen.getByRole("link", { name: "Atom feed", description: "Opens in a new tab" });

  expect(feedLink.getAttribute("href")).toBe(`${COLLECTION_WITH_FEED.route}/feed.xml`);
  expect(feedLink.getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("list")).toBeNull();
});

test("the list is a single tab stop, on the open entry", () => {
  const links = renderList(COLLECTION_ENTRIES[LAST_INDEX]!.slug);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
});

test("the tab stop falls on the first entry when no entry is open", () => {
  const links = renderList(null);
  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links[0]]);
});

test("the arrow keys move the focus along the list", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  links[0]!.focus();
  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(document.activeElement).toBe(links[1]);

  fireEvent.keyDown(links[1]!, { key: "ArrowUp" });

  expect(document.activeElement).toBe(links[0]);
});

test("the Home and End keys move the focus to the ends of the list, and the arrow keys stop there", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

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
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(playHoverSound).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(links[1]!, { key: "End" });

  expect(playHoverSound).toHaveBeenCalledTimes(2);
});

test("a key that does not move the focus at an end of the list does not play a detent", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowUp" });
  fireEvent.keyDown(links[0]!, { key: "Home" });

  expect(playHoverSound).not.toHaveBeenCalled();
});

test("pressing the Down arrow key while the window itself has the focus focuses the first entry, plays the hover sound, and prevents the key's default action", () => {
  const { windowRegion, links } = renderListInWindow(COLLECTION_ENTRIES[LAST_INDEX]!.slug);

  windowRegion.focus();

  expect(fireEvent.keyDown(windowRegion, { key: "ArrowDown" })).toBe(false);
  expect(document.activeElement).toBe(links[0]);
  expect(playHoverSound).toHaveBeenCalledTimes(1);
});

test("moving the focus scrolls the focused entry into view silently", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
});

test("focusing an entry makes it the tab stop", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.focus(links.at(-1)!);

  expect(links.filter((link) => link.tabIndex === 0)).toEqual([links.at(-1)]);
});

test("the Enter and Space keys open the focused entry", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.keyDown(links[1]!, { key: "Enter" });

  expect(open).toHaveBeenLastCalledWith(routeOf(1));

  fireEvent.keyDown(links.at(-1)!, { key: " " });

  expect(open).toHaveBeenLastCalledWith(routeOf(LAST_INDEX));
});

test("opening an entry opens its window at once, and flashes only that entry's highlight until the activation flash ends", () => {
  vi.useFakeTimers();

  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.keyDown(links[1]!, { key: "Enter" });

  expect(open).toHaveBeenCalledExactlyOnceWith(routeOf(1));
  expect(highlightOf(links[1]!)).toBe("off");
  expect(highlightOf(links[0]!)).toBeNull();

  advanceTimersBy(DEFAULT_ACTIVATION_FLASH_DURATION_MS / 4); // The flash's second step turns the highlight on.

  expect(highlightOf(links[1]!)).toBe("on");

  runActivationFlash();

  expect(highlightOf(links[1]!)).toBeNull();
});

test("opening an entry grows a zoom rect from its title toward the entry window", () => {
  const showZoomRect = vi.fn();
  const titleRect = new DOMRect(10, 20, 30, 40);

  showEntryInWindow(null);
  render(
    <ZoomRectContext value={showZoomRect}>
      <CollectionBody target={targetOf(COLLECTION)} />
    </ZoomRectContext>,
  );

  const link = screen.getAllByRole("link")[1]!;

  vi.spyOn(link.getElementsByClassName(styles.title)[0]!, "getBoundingClientRect").mockReturnValue(titleRect);
  fireEvent.keyDown(link, { key: "Enter" });

  expect(showZoomRect).toHaveBeenCalledExactlyOnceWith({ windowId: "entry", from: titleRect });
});

test("pressing an entry with the mouse plays the click sound", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  pressWithMouse(links[1]!);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a tap plays the click sound on its `click` event, but not when scrolling cancels it", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.pointerDown(links[1]!, { pointerType: "touch" });
  fireEvent.pointerUp(links[1]!, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.click(links[1]!, { detail: 1 });

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.pointerDown(links[2]!, { pointerType: "touch" });
  fireEvent.pointerCancel(links[2]!, { pointerType: "touch" });

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a press on an entry prevents the native focus, then focuses the entry and scrolls it into view silently", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the open entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, { button: 0 })).toBe(false); // The link prevented the default behavior.
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
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);
  const focus = vi.spyOn(links[1]!, "focus");

  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the open entry's own scroll.

  expect(fireEvent.mouseDown(links[1]!, press)).toBe(false); // The link prevented only the native focus, not its own click.
  expect(focus).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(links[1]);
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("a plain press only focuses the entry, so the browser does not follow the link", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.mouseDown(links[1]!, { button: 0, detail: 1 });

  expect(document.activeElement).toBe(links[1]);
  expect(fireEvent.click(links[1]!, { detail: 1 })).toBe(false); // The link prevented the default behavior.
  expect(open).not.toHaveBeenCalled();
});

test("a plain double press opens the entry", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  fireEvent.doubleClick(links[1]!);

  expect(open).toHaveBeenCalledExactlyOnceWith(routeOf(1));
});

test("a double tap opens the entry and plays the click sound, and a single tap does not open it", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);
  const tap = () => {
    fireEvent.pointerDown(links[1]!, { pointerType: "touch" });
    fireEvent.pointerUp(links[1]!, { pointerType: "touch" });
  };

  tap();

  expect(open).not.toHaveBeenCalled();
  expect(playClickSound).not.toHaveBeenCalled();

  tap();

  expect(open).toHaveBeenCalledExactlyOnceWith(routeOf(1));
  expect(playClickSound).toHaveBeenCalledOnce();

  fireEvent.click(links[1]!, { detail: 2 }); // The `click` of the second tap, which `useDoublePress` swallows.

  expect(playClickSound).toHaveBeenCalledOnce();
});

test.each(SCREEN_READER_ACTIVATIONS)(
  "a screen reader's activate action in %s opens the entry without playing the click sound",
  (_browser, activate) => {
    const links = renderList(COLLECTION_ENTRIES[0]!.slug);

    expect(activate(links[1]!)).toBe(false); // The link prevented the default behavior.
    expect(open).toHaveBeenCalledExactlyOnceWith(routeOf(1));
    expect(playClickSound).not.toHaveBeenCalled();
  },
);

test("a modified or middle press follows the link rather than opening the entry", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
    expect(fireEvent.click(links[1]!, { detail: 1, ...modifier })).toBe(true);
  }

  expect(fireEvent.click(links[1]!, { detail: 1, button: 1 })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});

test("a modified double press follows the link once, and does not also open the entry", () => {
  const links = renderList(COLLECTION_ENTRIES[0]!.slug);

  expect(fireEvent.click(links[1]!, { detail: 1, metaKey: true })).toBe(true);
  expect(fireEvent.click(links[1]!, { detail: 2, metaKey: true })).toBe(false); // The link prevented the default behavior of the repeated click.

  fireEvent.doubleClick(links[1]!, { metaKey: true });

  expect(open).not.toHaveBeenCalled();
});
