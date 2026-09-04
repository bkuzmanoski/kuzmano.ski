import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MAX_CLICK_DELAY_MS, swallowNextPress } from "./press.ts";

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

  target.addEventListener("click", onClick);
  target.addEventListener("mousedown", onMouseDown);
  document.body.append(target);

  return {
    onClick,
    onMouseDown,
    click: () => target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    mouseDown: () => target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })),
    press: () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  };
}

test("the focus the press would move is refused, while the press itself still reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();

  expect(target.mouseDown()).toBe(false);
  expect(target.onMouseDown).toHaveBeenCalledTimes(1);
});

test("the click that ends the press is swallowed before it reaches its target", () => {
  const target = pressTarget();

  swallowNextPress();

  expect(target.click()).toBe(false);
  expect(target.onClick).not.toHaveBeenCalled();
});

test("a press that follows the swallowed one keeps its own focus", () => {
  const target = pressTarget();

  swallowNextPress();
  target.mouseDown();
  target.click();

  expect(target.mouseDown()).toBe(true);
});

test("only one click is swallowed", () => {
  const target = pressTarget();

  swallowNextPress();
  target.click();

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});

test("a press that does not produce a click clears the swallow, so the next press is unaffected", () => {
  const target = pressTarget();

  swallowNextPress();
  target.press();

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});

test("a click too late to belong to the press is not swallowed", () => {
  const target = pressTarget();

  swallowNextPress();
  vi.advanceTimersByTime(MAX_CLICK_DELAY_MS);

  expect(target.click()).toBe(true);
  expect(target.onClick).toHaveBeenCalledTimes(1);
});
