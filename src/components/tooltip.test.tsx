import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Tooltip } from "./tooltip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const HOVER_DELAY_MS = 400;
const TAP_DISMISS_MS = 1_500;

const MOUSE = { pointerType: "mouse" };
const TOUCH = { pointerType: "touch" };

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

/** The sequence iOS Safari dispatches for a tap, synthesised mouse pointer and all. */
function tap(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerEnter(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper);
}

/** The same tap where the synthesised mouse pointer arrives after the press instead. */
function tapWithLateMouse(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper);
  fireEvent.pointerEnter(wrapper, MOUSE);
}

test("hovering shows the tooltip after the delay, and leaving hides it", () => {
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
  advance(TAP_DISMISS_MS);

  expect(tip()).toBeNull();

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).not.toBeNull();
});

test("a tapped tooltip hides itself without further input", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_DISMISS_MS - 1);

  expect(tip()).not.toBeNull();

  advance(1);

  expect(tip()).toBeNull();
});

test("the dismissal delay runs from when the tooltip appears, not from the tap", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  advance(TAP_DISMISS_MS - 200); // The press is still being handled.
  relabel("New Tip");
  advance(TAP_DISMISS_MS - 1);

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

test("tapping again re-reads the label and restarts the dismissal delay", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_DISMISS_MS - 100);

  tap(wrapper);
  relabel("Another New Tip");
  advance(TAP_DISMISS_MS - 100);

  expect(tip()?.textContent).toBe("Another New Tip");

  advance(100);

  expect(tip()).toBeNull();
});

test("tapping again holds the tooltip visible even when the label does not change", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("New Tip");
  advance(TAP_DISMISS_MS - 100);

  tap(wrapper); // The label already reads "New Tip", so the press changes nothing.
  advance(TAP_DISMISS_MS - 100);

  expect(tip()?.textContent).toBe("New Tip");

  advance(100);

  expect(tip()).toBeNull();
});

test("a cancelled touch takes the tooltip down rather than stranding it", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  relabel("Appearance: Light");

  expect(tip()).not.toBeNull();

  fireEvent.pointerCancel(wrapper, TOUCH);

  expect(tip()).toBeNull();

  relabel("Appearance: Dark"); // A later change must not resurrect it.

  expect(tip()).toBeNull();
});

test("a mouse press does not start the tap dismissal", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);
  fireEvent.pointerDown(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, MOUSE);
  advance(TAP_DISMISS_MS);

  expect(tip()).not.toBeNull();

  fireEvent.pointerLeave(wrapper, MOUSE);

  expect(tip()).toBeNull();
});

test("a tap still dismisses itself when the synthesised mouse pointer arrives late", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  tapWithLateMouse(wrapper);
  relabel("New Tip");

  expect(tip()).not.toBeNull();

  advance(TAP_DISMISS_MS);

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

test("a tooltip left open when it is suppressed does not return once suppression lifts", () => {
  const { wrapper, suppress } = renderTooltip({ label: "Next" });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).not.toBeNull();

  suppress(true);

  expect(tip()).toBeNull();

  suppress(false);

  expect(tip()).toBeNull();
});

test("a late synthesised mouse pointer does not show the tooltip when the press leaves the state unchanged", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  tapWithLateMouse(wrapper); // The press leaves the label as it was, so nothing should be shown.
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});
