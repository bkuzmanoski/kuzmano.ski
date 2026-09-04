import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DESTINATION_ORDER } from "#/config/navigation.ts";
import type * as BootSequenceLifecycle from "#/lib/boot-sequence/lifecycle.ts";
import type { WindowId } from "#/lib/window-manager/window.ts";
import { DESTINATIONS } from "#/site/navigation.ts";

import { DesktopIcons } from "./desktop-icons.tsx";

let focusedWindow: WindowId | null = null;

const open = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({
    actions: { open, focusDesktop: vi.fn() },
    focusedWindow: () => focusedWindow,
  }),
);
vi.mock("#/lib/boot-sequence/lifecycle.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BootSequenceLifecycle>()),
  useIsBootSequenceComplete: () => true,
}));
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
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
