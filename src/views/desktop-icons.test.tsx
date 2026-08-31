import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DESTINATIONS, DESTINATION_ORDER } from "#/content/navigation";
import type { WindowId } from "#/lib/window-manager";

import { DesktopIcons } from "./desktop-icons";

let focusedWindow: WindowId | null = null;

const open = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({
    actions: { open, focusDesktop: vi.fn() },
    focusedWindow: () => focusedWindow,
  }),
);
vi.mock("#/lib/boot-sequence/use-is-boot-sequence-complete", () => ({ useIsBootSequenceComplete: () => true }));
vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => {
  focusedWindow = null;
  open.mockClear();
});

const ICON_LABELS = DESTINATION_ORDER.map((id) => DESTINATIONS[id].title);

const icon = (index: number) => screen.getByLabelText(ICON_LABELS[index]!);

function renderIcons() {
  const { rerender } = render(<DesktopIcons onZoomRect={vi.fn()} />);
  return (nextFocusedWindow: WindowId | null) => {
    focusedWindow = nextFocusedWindow;
    rerender(<DesktopIcons onZoomRect={vi.fn()} />);
  };
}

/** The window a selected icon opened, which takes the focus and resigns when it closes. */
function openWindow(setFocusedWindow: (id: WindowId | null) => void, id: WindowId) {
  setFocusedWindow(id);
  (document.activeElement as HTMLElement | null)?.blur(); // The window's own focus goes with it when it unmounts.
}

test("the selected icon regains focus when the last window closes and remains keyboard-accessible", () => {
  const setFocusedWindow = renderIcons();

  icon(0).focus();
  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(1);

  openWindow(setFocusedWindow, "about" as WindowId);
  setFocusedWindow(null);

  expect(document.activeElement).toBe(icon(0));

  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(2);
});

test("closing the last window does not focus an icon if none is selected", () => {
  const setFocusedWindow = renderIcons();

  openWindow(setFocusedWindow, "about" as WindowId);
  setFocusedWindow(null);

  expect(document.activeElement).toBe(document.body);
});

test("closing the last window does not focus an icon if another element is focused", () => {
  const setFocusedWindow = renderIcons();
  const buttonElement = document.body.appendChild(document.createElement("button"));

  icon(0).focus();
  openWindow(setFocusedWindow, "about" as WindowId);
  buttonElement.focus();
  setFocusedWindow(null);

  expect(document.activeElement).toBe(buttonElement);

  buttonElement.remove();
});
