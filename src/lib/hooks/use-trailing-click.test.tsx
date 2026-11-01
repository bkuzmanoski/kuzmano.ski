import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { useTrailingClick } from "./use-trailing-click.ts";

const onConsume = vi.fn<(wasTrailingClickExpected: boolean) => void>();

/** A pointer click, as opposed to keyboard activation. */
const CLICK = { detail: 1 };

function Control({ label }: { label: string }) {
  const { recordPress, onPointerUp, consume } = useTrailingClick();

  return (
    <button
      type="button"
      onPointerDown={recordPress}
      onPointerUp={onPointerUp}
      onClick={(event) => onConsume(consume(event))}
    >
      {label}
    </button>
  );
}

const control = (label: string) => screen.getByRole("button", { name: label });

/** The touch pointer events stay on the element under the finger, and only the `click` reaches `element`. */
function tapRetargetedTo(element: Element) {
  fireEvent.pointerDown(document.body);
  fireEvent.pointerUp(document.body);
  fireEvent.click(element, CLICK);
}

function renderControls() {
  onConsume.mockClear();
  render(
    <>
      <Control label="First" />
      <Control label="Second" />
    </>,
  );
}

describe("useTrailingClick", () => {
  test("`consume` returns `true` for the `click` that ends a press on the control, and `false` for the next `click`", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(control("First"));
    fireEvent.click(control("First"), CLICK);
    fireEvent.click(control("First"), CLICK);

    expect(onConsume.mock.calls).toEqual([[true], [false]]);
  });

  test("`consume` returns `false` for a `click` without a press", () => {
    renderControls();
    fireEvent.click(control("First"), CLICK);

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for a `click` after a press that ends away from the control", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(document.body);
    fireEvent.click(control("First"), CLICK);

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for a `click` after a press that ends on another control", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(control("Second"));
    fireEvent.click(control("Second"), CLICK);

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for a `click` after the release of a non-primary button", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(control("First"), { button: 2 });
    fireEvent.click(control("First"), CLICK);

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for a key press's `click` after a `pointerup` on the control without a `click`", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(control("First"));
    fireEvent.click(control("First"), { detail: 0 });

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for the `click` of a retargeted tap after a `pointerup` on the control without a `click`", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(control("First"));
    tapRetargetedTo(control("First"));

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `false` for the `click` of a retargeted tap after a press that ends away from the control, and a later press that ends on it", () => {
    renderControls();
    fireEvent.pointerDown(control("First"));
    fireEvent.pointerUp(document.body);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(control("First"));
    tapRetargetedTo(control("First"));

    expect(onConsume).toHaveBeenCalledExactlyOnceWith(false);
  });

  test("`consume` returns `true` for the `click` that ends each of two presses in a row", () => {
    renderControls();

    for (let press = 0; press < 2; press++) {
      fireEvent.pointerDown(control("First"));
      fireEvent.pointerUp(control("First"));
      fireEvent.click(control("First"), CLICK);
    }

    expect(onConsume.mock.calls).toEqual([[true], [true]]);
  });
});
