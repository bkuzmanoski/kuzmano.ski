import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { ENTRY_DATE_FORMAT } from "#/config/content";
import { formatDate } from "#/lib/date";
import { testCollection } from "#/test-utils/content";

import { WindowToolbar } from "./window-toolbar";

const open = vi.hoisted(() => vi.fn());
const playClick = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({ actions: { open } }),
);
vi.mock("#/lib/audio/sounds", () => ({ playClick }));

beforeEach(() => {
  open.mockClear();
  playClick.mockClear();
});

const { collection, entries, routeOf } = testCollection("tech-notes", 3);
const lastEntryIndex = entries.length - 1;
const dateFormat = new Intl.DateTimeFormat(navigator.language, ENTRY_DATE_FORMAT.options);

test("the toolbar reports the entry's category and date", () => {
  const entry = entries[1]!;

  render(<WindowToolbar route={routeOf(1)} />);

  expect(screen.getByText(entry.category!)).toBeDefined();

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

test("the toolbar leads back to the collection that holds the entry", () => {
  render(<WindowToolbar route={routeOf(1)} />);

  const up = screen.getByRole("link", { name: `Back to ${collection.title}` });

  expect(up.getAttribute("href")).toBe("/tech-notes");

  fireEvent.click(up);

  expect(open).toHaveBeenCalledWith("/tech-notes");
});
