import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { WindowToolbar } from "#/features/windows/window-toolbar.tsx";
import { formatDate } from "#/lib/date.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import { collection, collectionEntries } from "#/test-utils/catalog.ts";

const open = vi.hoisted(() => vi.fn());
const playClick = vi.hoisted(() => vi.fn());
const writeText = vi.fn<(value: string) => Promise<void>>();

Object.defineProperty(navigator, "clipboard", { value: { writeText } });

vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());
vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playClick }),
);

beforeEach(() => {
  open.mockClear();
  playClick.mockClear();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

const lastEntryIndex = collectionEntries.length - 1;
const routeOf = (index: number) => collection.routeOf(collectionEntries[index]!.slug);
const dateFormat = new Intl.DateTimeFormat(navigator.language, ENTRY_DATE_FORMAT.options);

test("the toolbar reports the entry's date", () => {
  const entry = collectionEntries[1]!;

  render(<WindowToolbar route={routeOf(1)} />);

  const date = screen.getByText(formatDate(entry.date, dateFormat));

  expect(date.getAttribute("datetime")).toBe(entry.date);
});

test("the step controls link to the entries either side of the one being shown", () => {
  render(<WindowToolbar route={routeOf(1)} />);

  expect(screen.getByRole("link", { name: "Previous entry" }).getAttribute("href")).toBe(routeOf(0));
  expect(screen.getByRole("link", { name: "Next entry" }).getAttribute("href")).toBe(routeOf(2));
});

test("the step controls are disabled at each end of the collection", () => {
  const { unmount } = render(<WindowToolbar route={routeOf(0)} />);

  expect(screen.getByRole("button", { name: "Previous entry" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("link", { name: "Next entry" })).toBeDefined();

  unmount();
  render(<WindowToolbar route={routeOf(lastEntryIndex)} />);

  expect(screen.getByRole("link", { name: "Previous entry" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Next entry" }).hasAttribute("disabled")).toBe(true);
});

test("stepping to a sibling entry opens it in the entry window rather than following the link", () => {
  render(<WindowToolbar route={routeOf(1)} />);

  const next = screen.getByRole("link", { name: "Next entry" });

  fireEvent.pointerDown(next);
  fireEvent.click(next);

  expect(playClick).toHaveBeenCalled();
  expect(open).toHaveBeenCalledWith(routeOf(2));
});

test("the toolbar copies the entry's canonical URL rather than the address the window was opened from", async () => {
  render(<WindowToolbar route={routeOf(1)} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

  await act(async () => {
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith(canonicalUrl(routeOf(1)));
});
