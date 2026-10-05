import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { formatDate } from "#/lib/datetime.ts";
import type { Collection } from "#/site/catalog.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import { fakeCollection, fakeCollectionEntries, fakeEntry } from "#/test-utils/collection.ts";
import { RouterContext } from "#/test-utils/router-context.tsx";
import { collectionEntryTargetOf } from "#/test-utils/windows.ts";

import { EntryClipboardProvider } from "./entry-clipboard-provider.tsx";
import { EntryMasthead } from "./entry-masthead.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

const writeText = vi.fn<(value: string) => Promise<void>>();

Object.defineProperty(navigator, "clipboard", { value: { writeText } });

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const COLLECTION = fakeCollection(fakeCollectionEntries("entry"));
const ENTRY = COLLECTION.list()[0]!;
const BROWSER_LOCALE_DATE_FORMAT = new Intl.DateTimeFormat(navigator.language, ENTRY_DATE_FORMAT.options);

const renderMasthead = (inCollection: Collection = COLLECTION) =>
  render(
    <EntryClipboardProvider>
      <EntryMasthead target={collectionEntryTargetOf(inCollection, ENTRY.slug)} />
    </EntryClipboardProvider>,
    { wrapper: RouterContext },
  );

test("the masthead is marked with the `data-feed-omit` attribute", () => {
  const { container } = renderMasthead();
  expect(container.querySelector("[data-entry-masthead]")?.hasAttribute("data-feed-omit")).toBe(true);
});

test("the masthead links to the entry's collection, named by the collection's title", () => {
  renderMasthead();
  expect(screen.getByRole("link", { name: COLLECTION.title }).getAttribute("href")).toBe(COLLECTION.route);
});

test("the masthead renders the entry's date as a `<time>` with the date in its `datetime` attribute", () => {
  renderMasthead();

  const date = screen.getByText(formatDate(ENTRY.date, BROWSER_LOCALE_DATE_FORMAT));

  expect(date.tagName).toBe("TIME");
  expect(date.getAttribute("datetime")).toBe(ENTRY.date);
});

test("the masthead marks the entry's date with a `lang` attribute naming the browser's locale when its language differs from the document's", () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
  renderMasthead();

  expect(document.querySelector("time")?.getAttribute("lang")).toBe("de-DE");
});

test("the masthead renders the entry's category when its frontmatter specifies one", () => {
  renderMasthead(fakeCollection([fakeEntry(ENTRY.slug, { category: "Category" })]));
  expect(screen.getByText("Category")).toBeDefined();
});

test("pressing the `Copy link` button in the masthead copies the entry's canonical URL", async () => {
  renderMasthead();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

  await act(async () => {
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith(canonicalUrl(COLLECTION.routeOf(ENTRY.slug)));
});

test("the masthead shares the entry's canonical URL and title when the browser supports the Web Share API", async () => {
  const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined);

  Object.defineProperty(navigator, "share", { value: share, configurable: true });

  try {
    renderMasthead();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(share).toHaveBeenCalledWith({ url: canonicalUrl(COLLECTION.routeOf(ENTRY.slug)), title: ENTRY.title });
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});
