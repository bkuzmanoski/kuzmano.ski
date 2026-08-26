import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { HOVER_DELAY_MS, TAP_FEEDBACK_DURATION_MS, Tooltip } from "./tooltip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const MOUSE = { pointerType: "mouse" };
const TOUCH = { pointerType: "touch" };
const CLICK = { detail: 1 }; // A click a pointer sent, as opposed to a keyboard activation.

function renderTooltip({ label = "Tip", suppressed = false, persistOnPress = false } = {}) {
  let props = { label, suppressed };

  const view = () => (
    <Tooltip label={props.label} suppressed={props.suppressed} persistOnPress={persistOnPress}>
      <button type="button">Control</button>
    </Tooltip>
  );

  const { container, rerender } = render(view());

  const update = (next: Partial<typeof props>) =>
    act(() => {
      props = { ...props, ...next };
      rerender(view());
    });

  return {
    wrapper: container.firstElementChild!,
    relabel: (next: string) => update({ label: next }),
    suppress: (next: boolean) => update({ suppressed: next }),
  };
}

const tip = () => screen.queryByRole("tooltip");

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// The pointer sequence iOS Safari dispatches for a tap, including the synthesized mouse event.
function tap(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerEnter(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper, CLICK);
}

// A tap where the synthesized mouse event arrives after the touch sequence.
function tapWithLateMouseEvent(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper, CLICK);
  fireEvent.pointerEnter(wrapper, MOUSE);
}

/**
 * A tap iOS moves onto the control from just outside it. Only the synthesized mouse events and
 * the click follow the control; the touch's own pointer events went where the finger landed.
 */
function tapAdjustedOntoControl(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, MOUSE);
  fireEvent.click(wrapper, CLICK);
}

test("hovering shows the tooltip after the delay, and a pointer leaving hides it", () => {
  const { wrapper } = renderTooltip();

  fireEvent.pointerEnter(wrapper, MOUSE);

  expect(tip()).toBeNull();

  advance(HOVER_DELAY_MS);

  expect(tip()?.textContent).toBe("Tip");

  fireEvent.pointerLeave(wrapper, MOUSE);

  expect(tip()).toBeNull();
});

test("a tap keeps the tooltip hidden until the label reports the press", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);

  expect(tip()).toBeNull();

  relabel("New Tip");

  expect(tip()?.textContent).toBe("New Tip");
});

test("a tap whose press does not change the label does not show the tooltip", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  advance(TAP_FEEDBACK_DURATION_MS);

  expect(tip()).toBeNull();

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).not.toBeNull();
});

test("a tapped tooltip hides itself without further input", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_FEEDBACK_DURATION_MS - 1);

  expect(tip()).not.toBeNull();

  advance(1);

  expect(tip()).toBeNull();
});

test("the feedback duration interval starts when the tooltip appears, not when the tap occurs", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  advance(TAP_FEEDBACK_DURATION_MS - 200); // The press is still being handled.
  relabel("New Tip");
  advance(TAP_FEEDBACK_DURATION_MS - 1);

  expect(tip()).not.toBeNull();

  advance(1);

  expect(tip()).toBeNull();
});

test("a tap has no effect on a tooltip without `persistOnPress`", () => {
  const { wrapper, relabel } = renderTooltip();

  tap(wrapper);
  relabel("New Tip");
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("tapping again re-reads the label and restarts the feedback interval", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_FEEDBACK_DURATION_MS - 100);

  tap(wrapper);
  relabel("Another New Tip");
  advance(TAP_FEEDBACK_DURATION_MS - 100);

  expect(tip()?.textContent).toBe("Another New Tip");

  advance(100);

  expect(tip()).toBeNull();
});

test("tapping again holds the tooltip visible even when the label does not change", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_FEEDBACK_DURATION_MS - 100);

  tap(wrapper); // The label already reads "New Tip", so the press changes nothing.
  advance(TAP_FEEDBACK_DURATION_MS - 100);

  expect(tip()?.textContent).toBe("New Tip");

  advance(100);

  expect(tip()).toBeNull();
});

test("a cancelled touch event hides the tooltip", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("Appearance: Light");

  expect(tip()).not.toBeNull();

  fireEvent.pointerCancel(wrapper, TOUCH);

  expect(tip()).toBeNull();

  relabel("Appearance: Dark"); // A later change must not resurrect it.

  expect(tip()).toBeNull();
});

test("a mouse press does not start the tap feedback interval", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);
  fireEvent.pointerDown(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, MOUSE);
  fireEvent.click(wrapper, CLICK);
  advance(TAP_FEEDBACK_DURATION_MS);

  expect(tip()).not.toBeNull();

  fireEvent.pointerLeave(wrapper, MOUSE);

  expect(tip()).toBeNull();
});

test("a tap still hides the tooltip if a synthesized mouse event arrives after it", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tapWithLateMouseEvent(wrapper);
  relabel("New Tip");

  expect(tip()).not.toBeNull();

  advance(TAP_FEEDBACK_DURATION_MS);

  expect(tip()).toBeNull();
});

test("a synthesized mouse event that arrives following a tap does not show the tooltip when the press leaves the state unchanged", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  tapWithLateMouseEvent(wrapper); // The press leaves the label as it was, so nothing should be shown.
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a suppressed control does not show a tooltip on tap", () => {
  const { wrapper } = renderTooltip({ label: "Resize", persistOnPress: true, suppressed: true });

  tap(wrapper);

  expect(tip()).toBeNull();
});

test("a control with nothing to describe does not show a tooltip", () => {
  const { wrapper } = renderTooltip({ label: "Next", suppressed: true });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a tooltip that is open when it is suppressed does not return once its suppression is removed", () => {
  const { wrapper, suppress } = renderTooltip({ label: "Next" });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).not.toBeNull();

  suppress(true);

  expect(tip()).toBeNull();

  suppress(false);

  expect(tip()).toBeNull();
});

test("a tap iOS moves onto the control still reports the press", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tapAdjustedOntoControl(wrapper);
  relabel("New Tip");

  expect(tip()?.textContent).toBe("New Tip");

  advance(TAP_FEEDBACK_DURATION_MS);

  expect(tip()).toBeNull();
});

test("a keyboard activation does not report a press", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  fireEvent.click(wrapper); // A keyboard-driven click carries no detail.
  relabel("New Tip");

  expect(tip()).toBeNull();
});
