import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import menuStyles from "#/components/menu.module.css";
import { DESTINATION_ORDER } from "#/config/navigation.ts";
import { playClickSound, playHoverSound } from "#/lib/audio/sounds.ts";
import { ICON_POSITIONS_STORAGE_KEY } from "#/lib/desktop-icons/positions.ts";
import { LONG_PRESS_DURATION_MS } from "#/lib/menu/use-context-menu-press.ts";
import type * as StartupSequenceLifecycle from "#/lib/startup-sequence/lifecycle.ts";
import { ZoomRectContext } from "#/lib/window-manager/use-zoom-rect.ts";
import type { WindowContent, WindowId, WindowRecord } from "#/lib/window-manager/window.ts";
import { DESTINATIONS } from "#/site/navigation.ts";
import { movePointerOver, releasePointerOver, runActivationFlash } from "#/test-utils/menu.ts";
import { MOUSE_PRESS_INIT, SCREEN_READER_ACTIVATIONS, TOUCH_PRESS_INIT, pressWithMouse } from "#/test-utils/press.ts";
import { advanceTimersBy, advanceTimersToNextFrame } from "#/test-utils/timers.ts";

import { DesktopIcons } from "./desktop-icons.tsx";

let windowContent: WindowRecord<WindowContent> = {};
let focusedWindow: WindowId | null = null;
let notFoundRoute: string | null = null;
let isStartupSequenceComplete = true;

const open = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({
    actions: { open, focusDesktop: vi.fn() },
    content: () => windowContent,
    focusedWindow: () => focusedWindow,
    notFoundRoute: () => notFoundRoute,
  }),
);
vi.mock("#/lib/startup-sequence/lifecycle.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof StartupSequenceLifecycle>()),
  useIsStartupSequenceComplete: () => isStartupSequenceComplete,
}));
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => {
  vi.useFakeTimers();
  windowContent = {};
  focusedWindow = null;
  notFoundRoute = null;
  isStartupSequenceComplete = true;
  open.mockClear();
  vi.mocked(playClickSound).mockClear();
  vi.mocked(playHoverSound).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "elementFromPoint");
});

const ICON_LABELS = DESTINATION_ORDER.map((id) => DESTINATIONS[id].title);
const PRESS_POINT = { clientX: 100, clientY: 200 };
const TOUCH_PRESS = { ...TOUCH_PRESS_INIT, ...PRESS_POINT };
const SECONDARY_MOUSE_PRESS = { ...MOUSE_PRESS_INIT, button: 2, ...PRESS_POINT };
const CLEAN_UP_LABEL = "Clean Up Desktop";

const desktop = () => screen.getByRole("main");
const icon = (index: number) => screen.getByLabelText(ICON_LABELS[index]!);
const desktopMenu = () => screen.queryByRole("menu");
const cleanUpDesktopMenuItem = () => screen.getByRole("menuitem", { name: CLEAN_UP_LABEL });

function renderDesktop() {
  render(
    <main data-desktop="">
      <DesktopIcons />
    </main>,
  );
}

function renderIcons() {
  const { rerender } = render(<DesktopIcons />);
  return (nextFocusedWindow: WindowId | null, nextNotFoundRoute: string | null = null) => {
    focusedWindow = nextFocusedWindow;
    notFoundRoute = nextNotFoundRoute;
    rerender(<DesktopIcons />);
  };
}

function openWindow(setFocusedWindow: (id: WindowId | null) => void, id: WindowId) {
  setFocusedWindow(id);
  (document.activeElement as HTMLElement | null)?.blur();
}

/** Drags the first icon away from its default position and returns the `left` style of that default position. */
function dragFirstIconAway() {
  const defaultLeft = icon(0).style.left;

  fireEvent.pointerDown(icon(0), { ...TOUCH_PRESS, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(window, { pointerId: 1, buttons: 1, clientX: -200, clientY: 200 });
  advanceTimersToNextFrame(); // The drag reports its move in an animation frame.
  fireEvent.pointerUp(window, { pointerId: 1 });

  return defaultLeft;
}

function longPressDesktop() {
  fireEvent.pointerDown(desktop(), TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);
}

test("opening an icon's window grows a zoom rect from the icon", () => {
  const showZoomRect = vi.fn();
  const iconRect = new DOMRect(10, 20, 30, 40);

  render(
    <ZoomRectContext value={showZoomRect}>
      <DesktopIcons />
    </ZoomRectContext>,
  );
  vi.spyOn(icon(0), "getBoundingClientRect").mockReturnValue(iconRect);
  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(1);
  expect(showZoomRect).toHaveBeenCalledExactlyOnceWith({ windowId: "entry", from: iconRect });
});

test.each(DESTINATION_ORDER)("the %s icon renders a different glyph while a window is open at its route", (id) => {
  const { type, title, route } = DESTINATIONS[id];
  const glyphMarkup = () => screen.getByLabelText(title).querySelector("svg")?.outerHTML;
  const { rerender } = render(<DesktopIcons />);
  const closedGlyphMarkup = glyphMarkup();

  windowContent = { [type]: { route, title } };
  rerender(<DesktopIcons />);

  expect(closedGlyphMarkup).toBeDefined();
  expect(glyphMarkup()).not.toBe(closedGlyphMarkup);
});

test("pressing an arrow key when the desktop has focus focuses the first icon", () => {
  renderIcons();
  fireEvent.keyDown(document.body, { key: "ArrowDown" });

  expect(document.activeElement).toBe(icon(0));
});

test("pressing an arrow key when a window has focus does not focus an icon", () => {
  const setFocusedWindow = renderIcons();

  setFocusedWindow("entry");
  fireEvent.keyDown(document.body, { key: "ArrowDown" });

  expect(document.activeElement).toBe(document.body);
});

test("pressing an arrow key before the startup sequence completes does not focus an icon", () => {
  isStartupSequenceComplete = false;
  renderIcons();
  fireEvent.keyDown(document.body, { key: "ArrowDown" });

  expect(document.activeElement).toBe(document.body);
});

test("pressing the empty desktop clears the selection and makes the first icon the tab stop again", () => {
  renderDesktop();
  act(() => icon(1).focus()); // Focusing an icon selects it.

  expect(icon(1).tabIndex).toBe(0);

  fireEvent.pointerDown(desktop());

  expect(icon(1).tabIndex).toBe(-1);
  expect(icon(0).tabIndex).toBe(0);
});

test("closing the last window by a pointer press focuses the selected icon, and the Enter key still opens it", () => {
  const setFocusedWindow = renderIcons();

  icon(1).focus();
  fireEvent.keyDown(icon(1), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(1);

  openWindow(setFocusedWindow, "entry");
  fireEvent.pointerDown(document.body);
  setFocusedWindow(null);

  expect(document.activeElement).toBe(icon(1));

  fireEvent.keyDown(icon(1), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(2);
});

test("closing the last window by a keyboard action focuses the icon that is the tab stop when no icon is selected", () => {
  const setFocusedWindow = renderIcons();

  openWindow(setFocusedWindow, "entry");
  fireEvent.keyDown(document.body, { key: "w", code: "KeyW", altKey: true });
  setFocusedWindow(null);

  expect(document.activeElement).toBe(icon(0));
  expect(icon(0).tabIndex).toBe(0);
});

test.each(SCREEN_READER_ACTIVATIONS)(
  "closing the last window by a screen reader's activate action in %s focuses the icon that is the tab stop",
  (_browser, activate) => {
    const setFocusedWindow = renderIcons();

    openWindow(setFocusedWindow, "entry");
    render(<button type="button">Close</button>);
    activate(screen.getByRole("button", { name: "Close" }));
    setFocusedWindow(null);

    expect(document.activeElement).toBe(icon(0));
  },
);

test("holding the Enter key opens the icon's window once", () => {
  render(<DesktopIcons />);
  fireEvent.keyDown(icon(0), { key: "Enter" });
  fireEvent.keyDown(icon(0), { key: "Enter", repeat: true });

  expect(open).toHaveBeenCalledOnce();
});

test("holding Alt and the O key opens the icon's window once", () => {
  render(<DesktopIcons />);
  fireEvent.keyDown(icon(0), { code: "KeyO", altKey: true });
  fireEvent.keyDown(icon(0), { code: "KeyO", altKey: true, repeat: true });

  expect(open).toHaveBeenCalledOnce();
});

test("the Enter key with a modifier key does not open the icon's window, or prevent the key's default action", () => {
  render(<DesktopIcons />);

  expect(fireEvent.keyDown(icon(0), { key: "Enter", metaKey: true })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});

test("closing the last window by a pointer press leaves the focus on the body when no icon is selected", () => {
  const setFocusedWindow = renderIcons();

  openWindow(setFocusedWindow, "entry");
  fireEvent.pointerDown(document.body);
  setFocusedWindow(null);

  expect(document.activeElement).toBe(document.body);
});

test("dismissing the not-found alert by a keyboard action focuses the icon that is the tab stop", () => {
  const setDesktopState = renderIcons();

  setDesktopState(null, "/missing");
  fireEvent.keyDown(document.body, { key: "Enter" });
  setDesktopState(null, null);

  expect(document.activeElement).toBe(icon(0));
});

test("activating the desktop when it first renders does not focus an icon", () => {
  renderIcons();
  expect(document.activeElement).toBe(document.body);
});

test("closing the last window does not focus an icon when another element has the focus", () => {
  const setFocusedWindow = renderIcons();
  const buttonElement = document.body.appendChild(document.createElement("button"));

  icon(0).focus();
  openWindow(setFocusedWindow, "entry");
  buttonElement.focus();
  fireEvent.keyDown(buttonElement, { key: "w", code: "KeyW", altKey: true });
  setFocusedWindow(null);

  expect(document.activeElement).toBe(buttonElement);

  buttonElement.remove();
});

test("a `contextmenu` event on the desktop prevents its default action, plays the click sound, and opens a menu named `Desktop` at the press position with the `Clean Up Desktop` item", () => {
  renderDesktop();

  expect(fireEvent.contextMenu(desktop(), PRESS_POINT)).toBe(false);

  const menu = screen.getByRole("menu", { name: "Desktop" });

  expect(menu.parentElement!.style.getPropertyValue("--menu-press-x")).toBe(`${PRESS_POINT.clientX}px`);
  expect(menu.parentElement!.style.getPropertyValue("--menu-press-y")).toBe(`${PRESS_POINT.clientY}px`);
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([CLEAN_UP_LABEL]);
  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a `contextmenu` event on an icon does not open the desktop menu or prevent its default action", () => {
  renderDesktop();

  expect(fireEvent.contextMenu(icon(0), PRESS_POINT)).toBe(true);
  expect(desktopMenu()).toBeNull();
});

test("the desktop menu moves the focus to itself when it opens, and closes on a press outside it", () => {
  renderDesktop();
  fireEvent.contextMenu(desktop(), PRESS_POINT);

  expect(document.activeElement).toBe(desktopMenu());

  pressWithMouse(document.body);

  expect(desktopMenu()).toBeNull();
});

test("a `contextmenu` event on the desktop menu prevents its default action without closing the menu", () => {
  renderDesktop();
  fireEvent.contextMenu(desktop(), PRESS_POINT);

  expect(fireEvent.contextMenu(cleanUpDesktopMenuItem(), PRESS_POINT)).toBe(false);
  expect(desktopMenu()).not.toBeNull();
});

test("the Down arrow key moves the highlight in the desktop menu, the Right arrow key does not close it, and the Escape key closes it", () => {
  renderDesktop();
  fireEvent.contextMenu(desktop(), PRESS_POINT);
  fireEvent.keyDown(desktopMenu()!, { key: "ArrowDown" });

  expect(desktopMenu()!.getAttribute("aria-activedescendant")).toBe(cleanUpDesktopMenuItem().id);

  fireEvent.keyDown(desktopMenu()!, { key: "ArrowRight" });

  expect(desktopMenu()).not.toBeNull();

  fireEvent.keyDown(desktopMenu()!, { key: "Escape" });

  expect(desktopMenu()).toBeNull();
});

test("the Enter key in the desktop menu plays the click sound and, after the item's activation flash, resets the icon positions and closes the menu", () => {
  renderDesktop();

  const defaultLeft = dragFirstIconAway();

  vi.mocked(playClickSound).mockClear();
  fireEvent.contextMenu(desktop(), PRESS_POINT);
  fireEvent.keyDown(desktopMenu()!, { key: "ArrowDown" });
  fireEvent.keyDown(desktopMenu()!, { key: "Enter" });

  expect(playClickSound).toHaveBeenCalledTimes(2); // The menu opening and the item activating.
  expect(icon(0).style.left).not.toBe(defaultLeft);

  runActivationFlash();

  expect(icon(0).style.left).toBe(defaultLeft);
  expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).toBeNull();
  expect(desktopMenu()).toBeNull();
});

test("a secondary press that opens the desktop menu resets the icon positions when it moves to the item and releases there", () => {
  renderDesktop();

  const defaultLeft = dragFirstIconAway();

  expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).not.toBeNull();

  fireEvent.pointerDown(desktop(), SECONDARY_MOUSE_PRESS);
  fireEvent.contextMenu(desktop(), PRESS_POINT);
  movePointerOver(cleanUpDesktopMenuItem());
  releasePointerOver(cleanUpDesktopMenuItem(), { button: 2 });
  runActivationFlash();

  expect(icon(0).style.left).toBe(defaultLeft);
  expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).toBeNull();
});

test("the desktop menu stays open without activating the item when the secondary press that opened it releases where it began", () => {
  renderDesktop();
  fireEvent.pointerDown(desktop(), SECONDARY_MOUSE_PRESS);
  fireEvent.contextMenu(desktop(), PRESS_POINT);
  releasePointerOver(cleanUpDesktopMenuItem(), { button: 2, ...PRESS_POINT });
  runActivationFlash();

  expect(desktopMenu()).not.toBeNull();
});

test("a long press on the desktop plays the click sound and opens the desktop menu", () => {
  renderDesktop();
  longPressDesktop();

  expect(screen.getByRole("menu", { name: "Desktop" })).toBeTruthy();
  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a long press that opens the desktop menu plays the hover sound and highlights the item when it slides to it, and resets the icon positions when it releases there", () => {
  renderDesktop();

  const defaultLeft = dragFirstIconAway();

  vi.mocked(playClickSound).mockClear();
  longPressDesktop();
  movePointerOver(cleanUpDesktopMenuItem());

  expect(playHoverSound).toHaveBeenCalledOnce();
  expect(desktopMenu()!.getAttribute("aria-activedescendant")).toBe(cleanUpDesktopMenuItem().id);

  releasePointerOver(cleanUpDesktopMenuItem());

  expect(playClickSound).toHaveBeenCalledTimes(2); // The menu opening and the item activating.

  runActivationFlash();

  expect(icon(0).style.left).toBe(defaultLeft);
  expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).toBeNull();
});

test("the desktop menu stays open without activating the item when the long press that opened it releases where it began", () => {
  renderDesktop();
  longPressDesktop();
  releasePointerOver(cleanUpDesktopMenuItem(), PRESS_POINT);
  runActivationFlash();

  expect(desktopMenu()).not.toBeNull();
});

test("the desktop menu stays open when the long press that opened it releases outside the menu, and closes on the next press outside it", () => {
  renderDesktop();
  longPressDesktop();
  releasePointerOver(document.body, { clientX: 0, clientY: 0 });

  expect(desktopMenu()).not.toBeNull();

  fireEvent.pointerDown(document.body, TOUCH_PRESS);

  expect(desktopMenu()).toBeNull();
});

test("the desktop menu closes when the secondary press that opened it releases outside the menu", () => {
  renderDesktop();
  fireEvent.pointerDown(desktop(), SECONDARY_MOUSE_PRESS);
  fireEvent.contextMenu(desktop(), PRESS_POINT);
  releasePointerOver(document.body, { button: 2, clientX: 0, clientY: 0 });

  expect(desktopMenu()).toBeNull();
});

test("a long press opens the desktop menu above the press point, and a secondary mouse press opens it below", () => {
  renderDesktop();
  longPressDesktop();

  expect(desktopMenu()!.classList).toContain(menuStyles.abovePoint);

  fireEvent.pointerDown(document.body, TOUCH_PRESS);
  fireEvent.pointerDown(desktop(), SECONDARY_MOUSE_PRESS);
  fireEvent.contextMenu(desktop(), PRESS_POINT);

  expect(desktopMenu()!.classList).not.toContain(menuStyles.abovePoint);
});
