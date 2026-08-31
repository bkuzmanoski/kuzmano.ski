import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { ENTRY_DATE_FORMAT } from "#/config/content";
import { formatDate } from "#/lib/date";
import { canonicalUrl } from "#/metadata";
import { testCollection } from "#/test-utils/content";

import { WindowToolbar } from "./window-toolbar";

const open = vi.hoisted(() => vi.fn());
const playClick = vi.hoisted(() => vi.fn());
const writeText = vi.fn<(value: string) => Promise<void>>();

// jsdom has no clipboard. It is defined on `navigator` in place rather than stubbed over the whole
// object, which would drop the `language` the toolbar reads to format the entry's date.
Object.defineProperty(navigator, "clipboard", { value: { writeText } });

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playClick }),
);

beforeEach(() => {
  open.mockClear();
  playClick.mockClear();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

const { entries, routeOf } = testCollection("blog", 3);
const lastEntryIndex = entries.length - 1;
const dateFormat = new Intl.DateTimeFormat(navigator.language, ENTRY_DATE_FORMAT.options);

test("the toolbar reports the entry's date", () => {
  const entry = entries[1]!;

  render(<WindowToolbar route={routeOf(1)} />);

  const date = screen.getByText(formatDate(entry.date, dateFormat));

  expect(date.getAttribute("datetime")).toBe(entry.date);
});

test("an entry in the middle of a collection can step either way", () => {
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
