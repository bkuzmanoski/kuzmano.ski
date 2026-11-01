import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DOUBLE_PRESS_INTERVAL_MS, useDoublePress } from "./use-double-press.ts";

const acceptsDoublePress = vi.fn<() => boolean>();
const onDoublePress = vi.fn();

let now = 0;

function Target() {
  return <div data-testid="target" {...useDoublePress({ acceptsDoublePress, onDoublePress })} />;
}

beforeEach(() => {
  now = 0;
  acceptsDoublePress.mockReset().mockReturnValue(true);
  onDoublePress.mockClear();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<Target />);
});

const target = () => screen.getByTestId("target");

const setNow = (time: number) => {
  now = time;
};

function press({ x = 0, y = 0, pointerType = "touch" } = {}) {
  fireEvent.pointerDown(target(), {
    clientX: x,
    clientY: y,
    pointerType,
  });
  fireEvent.pointerUp(target(), {
    clientX: x,
    clientY: y,
    pointerType,
  });
}

describe("pointer input", () => {
  test("two touch presses within the interval fire a single double press", () => {
    press();
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press();

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a touch double press prevents the `click` and `dblclick` events that follow it from reaching the page", () => {
    const pageEvent = vi.fn();

    document.body.addEventListener("click", pageEvent);
    document.body.addEventListener("dblclick", pageEvent);
    press();
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press();
    fireEvent.click(target());
    fireEvent.doubleClick(target());
    document.body.removeEventListener("click", pageEvent);
    document.body.removeEventListener("dblclick", pageEvent);

    expect(pageEvent).not.toHaveBeenCalled();
    expect(onDoublePress).toHaveBeenCalledOnce();
  });

  test("a touch double press for which `acceptsDoublePress` returns `false` does not call `onDoublePress`, and lets the `click` event that follows it reach the page", () => {
    const pageClick = vi.fn();

    acceptsDoublePress.mockReturnValue(false);
    document.body.addEventListener("click", pageClick);
    press();
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press();
    fireEvent.click(target());
    document.body.removeEventListener("click", pageClick);

    expect(onDoublePress).not.toHaveBeenCalled();
    expect(pageClick).toHaveBeenCalledOnce();
  });

  test("two pen presses within the interval fire a single double press", () => {
    press({ pointerType: "pen" });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press({ pointerType: "pen" });

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a second press past the interval does not fire a double press, and pairs with the next press instead", () => {
    press();
    setNow(DOUBLE_PRESS_INTERVAL_MS + 1);
    press();

    expect(onDoublePress).not.toHaveBeenCalled();

    setNow(DOUBLE_PRESS_INTERVAL_MS + 2);
    press();

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a second press farther from the first than the tolerance does not fire a double press", () => {
    press({ x: 0, y: 0 });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press({ x: 0, y: 40 });

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a drag gesture does not participate in a double press", () => {
    fireEvent.pointerDown(target(), {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    fireEvent.pointerUp(target(), {
      clientX: 80,
      clientY: 0,
      pointerType: "touch",
    });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press({ x: 80, y: 0 });

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a canceled press does not participate in a double press", () => {
    press();
    fireEvent.pointerCancel(target(), { pointerType: "touch" });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press();

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a native double click does not cause a second double press after a touch double press", () => {
    press();
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press();
    fireEvent.doubleClick(target());

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });
});

describe("mouse", () => {
  test("mouse pointer events alone do not fire a double press", () => {
    press({ pointerType: "mouse" });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press({ pointerType: "mouse" });

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a native double click fires a double press after mouse pointer events", () => {
    press({ pointerType: "mouse" });
    setNow(DOUBLE_PRESS_INTERVAL_MS);
    press({ pointerType: "mouse" });
    fireEvent.doubleClick(target());

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a native double click fires a double press without preceding pointer events", () => {
    fireEvent.doubleClick(target());
    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a native double click for which `acceptsDoublePress` returns `false` does not call `onDoublePress`", () => {
    acceptsDoublePress.mockReturnValue(false);
    fireEvent.doubleClick(target());

    expect(onDoublePress).not.toHaveBeenCalled();
  });
});
