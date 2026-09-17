import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type { Icon } from "#/lib/icons/icon.ts";

import { DesktopIcon } from "./desktop-icon.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

const ICON: Icon = { id: "icon", kind: "entry", label: "Icon", route: "/page" };

const onOpen = vi.fn();
const onSelect = vi.fn();

beforeEach(() => {
  onOpen.mockClear();
  onSelect.mockClear();
});

function renderIcon() {
  render(
    <DesktopIcon
      iconDefinition={ICON}
      x={0}
      y={0}
      cellSize={72}
      selected={false}
      open={false}
      tabIndex={0}
      onSelect={onSelect}
      onOpen={onOpen}
      onMoveStart={vi.fn()}
      onMoveEnd={vi.fn()}
      onKeyDown={vi.fn()}
    />,
  );

  return screen.getByRole("link", { name: ICON.label });
}

test("the icon links to its route", () => {
  expect(renderIcon().getAttribute("href")).toBe(ICON.route);
});

test("a plain press only selects, so the link is not followed", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 0 });
  fireEvent.pointerUp(icon, { button: 0 });

  expect(onSelect).toHaveBeenCalledExactlyOnceWith(ICON);
  expect(fireEvent.click(icon, { detail: 1 })).toBe(false); // The default behavior was prevented.
  expect(onOpen).not.toHaveBeenCalled();
});

test("a plain double press opens the icon in place", () => {
  const icon = renderIcon();

  fireEvent.doubleClick(icon);

  expect(onOpen).toHaveBeenCalledOnce();
});

test("a secondary press does not select the icon", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 2 });

  expect(fireEvent.mouseDown(icon, { button: 2 })).toBe(false); // The default behavior, which selects the icon by focusing it, was prevented.
  expect(onSelect).not.toHaveBeenCalled(); // The browser opens its context menu over the icon instead.
  expect(fireEvent.mouseDown(icon)).toBe(true); // The default behavior is not prevented for a primary press.
});

test("a modified press is left for the browser to handle, and does not open the icon in place", () => {
  const icon = renderIcon();

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true); // The default behavior was not prevented.
  expect(onOpen).not.toHaveBeenCalled(); // The browser opens the icon's route in a new tab.
});

test("a modified double press follows the link once, and does not also open the icon in place", () => {
  const icon = renderIcon();

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true);
  expect(fireEvent.click(icon, { detail: 2, metaKey: true })).toBe(false); // The repeat was prevented.

  fireEvent.doubleClick(icon, { metaKey: true });

  expect(onOpen).not.toHaveBeenCalled();
});
