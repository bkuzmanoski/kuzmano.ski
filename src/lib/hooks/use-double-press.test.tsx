import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DOUBLE_PRESS_INTERVAL, useDoublePress } from "./use-double-press";

const onDoublePress = vi.fn();

let now = 0;

function Target() {
  return <div data-testid="target" {...useDoublePress({ onDoublePress })} />;
}

beforeEach(() => {
  now = 0;
  onDoublePress.mockClear();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<Target />);
});

const target = () => screen.getByTestId("target");

const at = (time: number) => {
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
    at(DOUBLE_PRESS_INTERVAL);
    press();

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("two pen presses within the interval fire a single double press", () => {
    press({ pointerType: "pen" });
    at(DOUBLE_PRESS_INTERVAL);
    press({ pointerType: "pen" });

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a second press past the interval does not fire, and starts a fresh pairing", () => {
    press();
    at(DOUBLE_PRESS_INTERVAL + 1);
    press();

    expect(onDoublePress).not.toHaveBeenCalled();

    at(DOUBLE_PRESS_INTERVAL + 2);
    press();

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a second press landing too far from the first does not fire a double press", () => {
    press({ x: 0, y: 0 });
    at(DOUBLE_PRESS_INTERVAL);
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
    at(DOUBLE_PRESS_INTERVAL);
    press({ x: 80, y: 0 });

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a cancelled press does not participate in a double press", () => {
    press();
    fireEvent.pointerCancel(target(), { pointerType: "touch" });
    at(DOUBLE_PRESS_INTERVAL);
    press();

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a native double click does not cause a second double press after a touch double press", () => {
    press();
    at(DOUBLE_PRESS_INTERVAL);
    press();
    fireEvent.doubleClick(target());

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });
});

describe("mouse", () => {
  test("mouse pointer events alone do not fire a double press", () => {
    press({ pointerType: "mouse" });
    at(DOUBLE_PRESS_INTERVAL);
    press({ pointerType: "mouse" });

    expect(onDoublePress).not.toHaveBeenCalled();
  });

  test("a native double click fires a double press after mouse pointer events", () => {
    press({ pointerType: "mouse" });
    at(DOUBLE_PRESS_INTERVAL);
    press({ pointerType: "mouse" });
    fireEvent.doubleClick(target());

    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });

  test("a native double click fires a double press without preceding pointer events", () => {
    fireEvent.doubleClick(target());
    expect(onDoublePress).toHaveBeenCalledTimes(1);
  });
});
