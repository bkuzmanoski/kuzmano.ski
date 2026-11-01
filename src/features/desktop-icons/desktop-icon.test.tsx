import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import type { Icon } from "#/lib/desktop-icons/icon.ts";
import { SCREEN_READER_ACTIVATIONS, pressWithMouse } from "#/test-utils/press.ts";

import { DesktopIcon } from "./desktop-icon.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

const ICON: Icon = { id: "icon", kind: "entry", label: "Icon", route: "/page" };

const onOpen = vi.fn();
const onSelect = vi.fn();
const onMoveEnd = vi.fn();

beforeEach(() => {
  onOpen.mockClear();
  onSelect.mockClear();
  onMoveEnd.mockClear();
  vi.mocked(playClickSound).mockClear();
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
      onMoveEnd={onMoveEnd}
      onKeyDown={vi.fn()}
    />,
  );

  return screen.getByRole("link", { name: ICON.label });
}

test("the icon states the shortcut that opens it with its `aria-keyshortcuts` attribute", () => {
  expect(renderIcon().getAttribute("aria-keyshortcuts")).toBe("Alt+O");
});

test("the icon links to its route", () => {
  expect(renderIcon().getAttribute("href")).toBe(ICON.route);
});

test("a plain press only selects, so the browser does not follow the link", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 0 });
  fireEvent.pointerUp(icon, { button: 0 });

  expect(onSelect).toHaveBeenCalledExactlyOnceWith(ICON);
  expect(fireEvent.click(icon, { detail: 1 })).toBe(false); // The icon prevented the default behavior.
  expect(onOpen).not.toHaveBeenCalled();
});

test("a plain double press opens the icon in place", () => {
  const icon = renderIcon();

  fireEvent.doubleClick(icon);

  expect(onOpen).toHaveBeenCalledOnce();
});

test.each(SCREEN_READER_ACTIVATIONS)(
  "a screen reader's activate action in %s opens the icon in place without playing the click sound",
  (_browser, activate) => {
    const icon = renderIcon();

    expect(activate(icon)).toBe(false); // The icon prevented the default behavior.
    expect(onOpen).toHaveBeenCalledOnce();
    expect(playClickSound).not.toHaveBeenCalled();
  },
);

test("a press with the mouse plays the click sound", () => {
  pressWithMouse(renderIcon());
  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a secondary press does not select the icon", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 2 });

  expect(fireEvent.mouseDown(icon, { button: 2 })).toBe(false); // The icon prevented the default behavior, which selects the icon by focusing it.
  expect(onSelect).not.toHaveBeenCalled(); // The browser opens its context menu over the icon instead.
  expect(fireEvent.mouseDown(icon)).toBe(true); // The icon does not prevent the default behavior of a primary press.
});

test("a modified press plays the click sound and follows the link, without selecting the icon or opening it in place", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 0, metaKey: true });

  expect(fireEvent.mouseDown(icon, { button: 0, metaKey: true })).toBe(false); // The icon prevented the default behavior, which selects the icon by focusing it.

  fireEvent.pointerUp(icon, { button: 0, metaKey: true });

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true); // The icon did not prevent the default behavior.
  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled(); // The browser opens the icon's route in a new tab.
});

test.each(SCREEN_READER_ACTIVATIONS)(
  "a screen reader's activate action in %s opens the icon in place after a drag of the icon",
  (_browser, activate) => {
    const icon = renderIcon();

    fireEvent.pointerDown(icon, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { buttons: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
    fireEvent.click(icon, { detail: 1 });

    expect(onOpen).not.toHaveBeenCalled();

    activate(icon);

    expect(onOpen).toHaveBeenCalledOnce();
  },
);

test("a modified press after a drag of the icon follows the link", () => {
  const icon = renderIcon();

  fireEvent.pointerDown(icon, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(window, { buttons: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
  fireEvent.click(icon, { detail: 1 });

  expect(onMoveEnd).toHaveBeenCalledOnce();

  fireEvent.pointerDown(icon, { button: 0, metaKey: true });
  fireEvent.pointerUp(icon, { button: 0, metaKey: true });

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true);
});

test("a modified double press follows the link once, and does not also open the icon in place", () => {
  const icon = renderIcon();

  expect(fireEvent.click(icon, { detail: 1, metaKey: true })).toBe(true);
  expect(fireEvent.click(icon, { detail: 2, metaKey: true })).toBe(false); // The repeat was prevented.

  fireEvent.doubleClick(icon, { metaKey: true });

  expect(onOpen).not.toHaveBeenCalled();
});
