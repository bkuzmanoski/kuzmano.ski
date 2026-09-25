import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DESTINATION_ORDER } from "#/config/navigation.ts";
import type * as BootSequenceLifecycle from "#/lib/boot-sequence/lifecycle.ts";
import { MAX_CLICK_DELAY_MS } from "#/lib/press.ts";
import type { WindowId } from "#/lib/window-manager/window.ts";
import { DESTINATIONS } from "#/site/navigation.ts";

import { DesktopIcons } from "./desktop-icons.tsx";

let focusedWindow: WindowId | null = null;
let notFoundRoute: string | null = null;

const open = vi.hoisted(() => vi.fn());
const prefersReducedMotion = vi.hoisted(() => ({ matches: false }));

vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({
    actions: { open, focusDesktop: vi.fn() },
    focusedWindow: () => focusedWindow,
    notFoundRoute: () => notFoundRoute,
  }),
);
vi.mock("#/lib/boot-sequence/lifecycle.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BootSequenceLifecycle>()),
  useIsBootSequenceComplete: () => true,
}));
vi.mock("#/lib/hooks/use-prefers-reduced-motion.ts", () => ({
  getPrefersReducedMotion: () => prefersReducedMotion.matches,
  usePrefersReducedMotion: () => prefersReducedMotion.matches,
}));
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => {
  focusedWindow = null;
  notFoundRoute = null;
  open.mockClear();
  prefersReducedMotion.matches = false;
});

const ICON_LABELS = DESTINATION_ORDER.map((id) => DESTINATIONS[id].title);

const icon = (index: number) => screen.getByLabelText(ICON_LABELS[index]!);

function renderIcons() {
  const { rerender } = render(<DesktopIcons onZoomRect={vi.fn()} />);
  return (nextFocusedWindow: WindowId | null, nextNotFoundRoute: string | null = null) => {
    focusedWindow = nextFocusedWindow;
    notFoundRoute = nextNotFoundRoute;
    rerender(<DesktopIcons onZoomRect={vi.fn()} />);
  };
}

function openWindow(setFocusedWindow: (id: WindowId | null) => void, id: WindowId) {
  setFocusedWindow(id);
  (document.activeElement as HTMLElement | null)?.blur();
}

test.each([
  ["shows a zoom rect growing from the icon", false, 1],
  ["does not show a zoom rect growing from the icon under a reduced motion preference", true, 0],
])("opening an icon's window %s", (_label, isMotionReduced, zoomRectCount) => {
  const onZoomRect = vi.fn();

  prefersReducedMotion.matches = isMotionReduced;

  render(<DesktopIcons onZoomRect={onZoomRect} />);
  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(1);
  expect(onZoomRect).toHaveBeenCalledTimes(zoomRectCount);
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

test("closing the last window `MAX_CLICK_DELAY_MS` after a pointer press focuses the icon that is the tab stop", () => {
  const setFocusedWindow = renderIcons();

  openWindow(setFocusedWindow, "entry");
  fireEvent.pointerDown(document.body);

  const now = vi.spyOn(performance, "now").mockReturnValue(performance.now() + MAX_CLICK_DELAY_MS);

  setFocusedWindow(null);
  now.mockRestore();

  expect(document.activeElement).toBe(icon(0));
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
