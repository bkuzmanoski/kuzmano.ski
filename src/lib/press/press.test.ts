import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MAX_CLICK_DELAY_MS, isPointerClick, listenForPointerRelease, swallowNextPress } from "./press.ts";

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  document.body.replaceChildren();
  vi.useRealTimers();
});

function pressTarget() {
  const target = document.createElement("button");
  const onClick = vi.fn();
  const onMouseDown = vi.fn();
  const onDoubleClick = vi.fn();

  target.addEventListener("click", onClick);
  target.addEventListener("mousedown", onMouseDown);
  target.addEventListener("dblclick", onDoubleClick);
  document.body.append(target);

  return {
    onClick,
    onMouseDown,
    onDoubleClick,
    click: () => target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    mouseDown: () => target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })),
    doubleClick: () => target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true })),
    press: () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  };
}

test("`isPointerClick` returns `false` for a `click` event with a `detail` of `1` and an empty `pointerType`", () => {
  expect(isPointerClick(Object.assign(new MouseEvent("click", { detail: 1 }), { pointerType: "" }))).toBe(false); // Firefox dispatches this `click` for a screen reader's activate action.
});

test("`isPointerClick` returns `true` for a `click` event with a `pointerType` of `mouse`, or without a `pointerType`", () => {
  expect(isPointerClick(Object.assign(new MouseEvent("click", { detail: 1 }), { pointerType: "mouse" }))).toBe(true);
  expect(isPointerClick(new MouseEvent("click", { detail: 1 }))).toBe(true);
});

test("swallowing the next press prevents its focus change, while its mouse down event still reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();

  expect(target.mouseDown()).toBe(false);
  expect(target.onMouseDown).toHaveBeenCalledTimes(1);
});

test("swallowing the next press stops the click that ends it before the click reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();

  expect(target.click()).toBe(false);
  expect(target.onClick).not.toHaveBeenCalled();
});

test("swallowing the next press does not prevent the focus change of the press after it", () => {
  const target = pressTarget();

  swallowNextPress();
  target.mouseDown();
  target.click();

  expect(target.mouseDown()).toBe(true);
});

test("a second click after the swallowed press reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();
  target.click();

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});

test("swallowing the next press stops the double click that follows its click before the double click reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();
  target.click();
  target.doubleClick();

  expect(target.onDoubleClick).not.toHaveBeenCalled();
});

test("a double click after the next pointer down event reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();
  target.click();
  target.press();
  target.doubleClick();

  expect(target.onDoubleClick).toHaveBeenCalledOnce();
});

test("a click after the next pointer down event reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();
  target.press();

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});

test("a click once `MAX_CLICK_DELAY_MS` has passed reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();
  vi.advanceTimersByTime(MAX_CLICK_DELAY_MS);

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});

test.each(["pointerup", "pointercancel"])(
  "`listenForPointerRelease` calls its callback only for the first `%s` event on the window",
  (type) => {
    const onRelease = vi.fn();

    listenForPointerRelease(onRelease);
    window.dispatchEvent(new Event(type));
    window.dispatchEvent(new Event(type));

    expect(onRelease).toHaveBeenCalledTimes(1);
  },
);

test("`listenForPointerRelease` stops listening when its returned function is called", () => {
  const onRelease = vi.fn();

  listenForPointerRelease(onRelease)();
  window.dispatchEvent(new Event("pointerup"));

  expect(onRelease).not.toHaveBeenCalled();
});
