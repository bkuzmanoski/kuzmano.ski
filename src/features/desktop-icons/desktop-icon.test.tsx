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

  expect(fireEvent.click(icon, { detail: 1 })).toBe(false); // The default was prevented.
  expect(onOpen).not.toHaveBeenCalled();
});

test("a plain double press opens the icon in place", () => {
  const icon = renderIcon();

  fireEvent.doubleClick(icon);

  expect(onOpen).toHaveBeenCalledOnce();
});

test("a secondary press does not select the icon, as the browser opens its own menu over it", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 2 });

  expect(fireEvent.mouseDown(icon, { button: 2 })).toBe(false); // The default, which selects the icon by focusing it, was prevented.
  expect(onSelect).not.toHaveBeenCalled();
  expect(fireEvent.mouseDown(icon)).toBe(true); // A press that does select it keeps that default.
});

test("a modified press is left to the browser, which opens the route in a new tab", () => {
  const icon = renderIcon();

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true); // The default was not prevented.
  expect(onOpen).not.toHaveBeenCalled();
});

test("a modified double press follows the link once, and does not also open the icon in place", () => {
  const icon = renderIcon();

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true);
  expect(fireEvent.click(icon, { detail: 2, metaKey: true })).toBe(false); // The repeat was prevented.

  fireEvent.doubleClick(icon, { metaKey: true });

  expect(onOpen).not.toHaveBeenCalled();
});
