import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { advanceTimersBy } from "#/test-utils/timers.ts";

import { playClickSound } from "../audio/sounds.ts";

import { LONG_PRESS_DURATION_MS, LONG_PRESS_TOLERANCE_PX, useContextMenuPress } from "./use-context-menu-press.ts";

import type { ContextMenuPress } from "./use-context-menu-press.ts";

vi.mock("../audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

const onPress = vi.fn<(press: ContextMenuPress) => void>();

beforeEach(() => {
  onPress.mockClear();
  vi.mocked(playClickSound).mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const POSITION = { clientX: 100, clientY: 200 };
const TOUCH_PRESS = { pointerType: "touch", pointerId: 1, button: 0, isPrimary: true, ...POSITION };
const MOUSE_PRESS = { pointerType: "mouse", pointerId: 1, button: 0, isPrimary: true, ...POSITION };

function Target() {
  useContextMenuPress({ isTarget: (target) => target === document.querySelector("[data-target]"), onPress });
  return (
    <>
      <div data-testid="target" data-target="" />
      <div data-testid="other" />
    </>
  );
}

function renderTarget() {
  render(<Target />);
  return { target: screen.getByTestId("target"), other: screen.getByTestId("other") };
}

test("a `contextmenu` event on the target prevents its default action, plays the click sound, and opens the menu", () => {
  const { target } = renderTarget();

  expect(fireEvent.contextMenu(target, POSITION)).toBe(false);
  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: false,
    pointerType: "mouse",
  });
});

test("a `contextmenu` event on another element does not prevent its default action or open the menu", () => {
  const { other } = renderTarget();

  expect(fireEvent.contextMenu(other, POSITION)).toBe(true);
  expect(onPress).not.toHaveBeenCalled();
});

test("a `contextmenu` event during a press on the target reports the pointer as held, like the event on macOS", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, { ...MOUSE_PRESS, button: 2 });
  fireEvent.contextMenu(target, POSITION);

  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: true,
    pointerType: "mouse",
  });
});

test("a `contextmenu` event after the release of a press on the target reports the pointer as released, like the event on Windows", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, { ...MOUSE_PRESS, button: 2 });
  fireEvent.pointerUp(target, { ...MOUSE_PRESS, button: 2 });
  fireEvent.contextMenu(target, POSITION);

  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: false,
    pointerType: "mouse",
  });
});

test("a mouse press on the target with the Alt key held opens the menu on `mousedown`, and prevents the default action of `mousedown`", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, { ...MOUSE_PRESS, altKey: true });

  expect(onPress).not.toHaveBeenCalled();
  expect(fireEvent.mouseDown(target, { ...POSITION, altKey: true, detail: 1 })).toBe(false);
  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: true,
    pointerType: "mouse",
  });
});

test("a mouse press on the target without the Alt key held does not open the menu or prevent the default action of `mousedown`", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, MOUSE_PRESS);

  expect(fireEvent.mouseDown(target, { ...POSITION, detail: 1 })).toBe(true);

  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).not.toHaveBeenCalled();
});

test("a mouse press on another element with the Alt key held does not open the menu", () => {
  const { other } = renderTarget();

  fireEvent.pointerDown(other, { ...MOUSE_PRESS, altKey: true });
  fireEvent.mouseDown(other, { ...POSITION, altKey: true, detail: 1 });

  expect(onPress).not.toHaveBeenCalled();
});

test("a touch press on the target with the Alt key held opens the menu on `pointerdown`", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, { ...TOUCH_PRESS, altKey: true });

  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: true,
    pointerType: "touch",
  });
});

test("a long press on the target plays the click sound and opens the menu with the pointer held when its duration elapses", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS - 1);

  expect(onPress).not.toHaveBeenCalled();

  advanceTimersBy(1);

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: true,
    pointerType: "touch",
  });
});

test("a pen press on the target opens the menu when the long press duration elapses", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, { ...TOUCH_PRESS, pointerType: "pen" });
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).toHaveBeenCalledOnce();
});

test("a touch press on another element does not open the menu when the long press duration elapses", () => {
  const { other } = renderTarget();

  fireEvent.pointerDown(other, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).not.toHaveBeenCalled();
});

test("a long press that drifts within its tolerance opens the menu at the pointer's latest position", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  fireEvent.pointerMove(target, { ...TOUCH_PRESS, clientX: 100 + LONG_PRESS_TOLERANCE_PX });
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100 + LONG_PRESS_TOLERANCE_PX, y: 200 },
    isPointerHeld: true,
    pointerType: "touch",
  });
});

test("a touch press that drifts beyond the long press tolerance does not open the menu", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  fireEvent.pointerMove(target, { ...TOUCH_PRESS, clientX: 100 + LONG_PRESS_TOLERANCE_PX + 1 });
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).not.toHaveBeenCalled();
});

test.each([
  ["a release", "pointerUp"],
  ["a canceled gesture", "pointerCancel"],
] as const)("%s before the long press duration elapses does not open the menu", (_label, eventName) => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  fireEvent[eventName](target, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).not.toHaveBeenCalled();
});

test("a second touch before the long press duration elapses does not open the menu", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  fireEvent.pointerDown(target, { ...TOUCH_PRESS, pointerId: 2, isPrimary: false });
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).not.toHaveBeenCalled();
});

test("after a long press opens the menu, a `contextmenu` event prevents its default action without opening the menu again", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(fireEvent.contextMenu(target, POSITION)).toBe(false);
  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledOnce();
});

test("a `contextmenu` event during a long press opens the menu once with the pointer held, and the long press timer does not open it again", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  fireEvent.contextMenu(target, { clientX: 0, clientY: 0 });
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledExactlyOnceWith({
    origin: { x: 100, y: 200 },
    isPointerHeld: true,
    pointerType: "touch",
  });
});

test("a press after a released long press opens the menu again", () => {
  const { target } = renderTarget();

  fireEvent.pointerDown(target, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);
  fireEvent.pointerUp(target, TOUCH_PRESS);
  fireEvent.pointerDown(target, TOUCH_PRESS);
  advanceTimersBy(LONG_PRESS_DURATION_MS);

  expect(onPress).toHaveBeenCalledTimes(2);
});
