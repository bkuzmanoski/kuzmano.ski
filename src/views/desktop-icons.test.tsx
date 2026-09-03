import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DESTINATION_ORDER } from "#/config/navigation";
import type { WindowId } from "#/lib/window-manager/window";
import { DESTINATIONS } from "#/site/navigation";

import { DesktopIcons } from "./desktop-icons";

let focusedWindow: WindowId | null = null;

const open = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager/context", async () =>
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

function openWindow(setFocusedWindow: (id: WindowId | null) => void, id: WindowId) {
  setFocusedWindow(id);
  (document.activeElement as HTMLElement | null)?.blur();
}

test("the selected icon regains focus when the last window closes and remains keyboard-accessible", () => {
  const setFocusedWindow = renderIcons();

  icon(0).focus();
  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(1);

  openWindow(setFocusedWindow, "entry");
  setFocusedWindow(null);

  expect(document.activeElement).toBe(icon(0));

  fireEvent.keyDown(icon(0), { key: "Enter" });

  expect(open).toHaveBeenCalledTimes(2);
});

test("closing the last window does not focus an icon when none is selected", () => {
  const setFocusedWindow = renderIcons();

  openWindow(setFocusedWindow, "entry");
  setFocusedWindow(null);

  expect(document.activeElement).toBe(document.body);
});

test("closing the last window does not focus an icon when another element holds the focus", () => {
  const setFocusedWindow = renderIcons();
  const buttonElement = document.body.appendChild(document.createElement("button"));

  icon(0).focus();
  openWindow(setFocusedWindow, "entry");
  buttonElement.focus();
  setFocusedWindow(null);

  expect(document.activeElement).toBe(buttonElement);

  buttonElement.remove();
});
