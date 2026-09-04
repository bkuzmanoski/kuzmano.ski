import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { GRACE_PERIOD_MS, HIDE_DELAY_MS, resetTooltipState } from "#/lib/tooltip.ts";

import { HOVER_DELAY_MS, Tooltip } from "./tooltip.tsx";

beforeEach(() => {
  vi.useFakeTimers();
  resetTooltipState();
});

afterEach(() => vi.useRealTimers());

const MOUSE = { pointerType: "mouse" };
const TOUCH = { pointerType: "touch" };

function renderTooltip({
  label = "Tip",
  persistOnPress = false,
  suppressed = false,
  onDidHide,
}: { label?: string; persistOnPress?: boolean; suppressed?: boolean; onDidHide?: () => void } = {}) {
  let props = { label, showsState: false, suppressed };

  const view = () => (
    <Tooltip
      label={props.label}
      persistOnPress={persistOnPress}
      showsState={props.showsState}
      suppressed={props.suppressed}
      onDidHide={onDidHide}
    >
      <button type="button">Control</button>
    </Tooltip>
  );

  const { container, rerender, unmount } = render(view());

  const update = (next: Partial<typeof props>) =>
    act(() => {
      props = { ...props, ...next };
      rerender(view());
    });

  return {
    wrapper: container.firstElementChild!,
    unmount,
    relabel: (next: string) => update({ label: next }),
    setShowsState: (next: boolean) => update({ showsState: next }),
    suppress: (next: boolean) => update({ suppressed: next }),
  };
}

function renderTooltipGroup() {
  const { container } = render(
    <>
      <span>
        <Tooltip label="First">
          <button type="button">First</button>
        </Tooltip>
        <Tooltip label="Second">
          <button type="button">Second</button>
        </Tooltip>
      </span>
      <Tooltip label="Elsewhere">
        <button type="button">Elsewhere</button>
      </Tooltip>
    </>,
  );

  const wrapperOf = (label: string) => screen.getByRole("button", { name: label }).parentElement!;

  return { first: wrapperOf("First"), second: wrapperOf("Second"), elsewhere: container.lastElementChild! };
}

function renderStateControls() {
  let props = { first: false, second: false, third: false };

  const view = () => (
    <span>
      <Tooltip label="First" showsState={props.first}>
        <button type="button">First</button>
      </Tooltip>
      <Tooltip label="Second" showsState={props.second}>
        <button type="button">Second</button>
      </Tooltip>
      <Tooltip label="Third" showsState={props.third}>
        <button type="button">Third</button>
      </Tooltip>
    </span>
  );

  const { rerender } = render(view());

  const update = (next: Partial<typeof props>) =>
    act(() => {
      props = { ...props, ...next };
      rerender(view());
    });

  return {
    showFirst: () => update({ first: true }),
    showSecond: () => update({ second: true }),
    showThird: () => update({ third: true }),
  };
}

const tip = () => screen.queryByRole("tooltip");

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function hoverTooltipUntilShown(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);
}

// The pointer event sequence iOS Safari dispatches for a tap, including its synthesized mouse event.
function tap(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerEnter(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper);
}

// A tap whose synthesized mouse event arrives after the touch sequence rather than within it.
function tapWithLateMouseEvent(wrapper: Element) {
  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  fireEvent.click(wrapper);
  fireEvent.pointerEnter(wrapper, MOUSE);
}

function focusWithKeyboard(control: HTMLElement) {
  vi.spyOn(control, "matches").mockReturnValue(true);
  fireEvent.focus(control);
  advance(0);
}

test("hovering shows the tooltip after the hover delay", () => {
  const { wrapper } = renderTooltip();

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS - 1);

  expect(tip()).toBeNull();

  advance(1);

  expect(tip()?.textContent).toBe("Tip");
});

test("a pointer leaving the tooltip hides the it after the hide delay", () => {
  const { wrapper } = renderTooltip();

  hoverTooltipUntilShown(wrapper);
  fireEvent.pointerLeave(wrapper, MOUSE);

  expect(tip()?.textContent).toBe("Tip");

  advance(HIDE_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a press hides the tooltip immediately", () => {
  const { wrapper } = renderTooltip();

  hoverTooltipUntilShown(wrapper);
  fireEvent.pointerDown(wrapper, MOUSE);

  expect(tip()).toBeNull();
});

test("a press does not hide the tooltip when the control persists it", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  hoverTooltipUntilShown(wrapper);
  fireEvent.pointerDown(wrapper, MOUSE);
  fireEvent.pointerUp(wrapper, MOUSE);
  fireEvent.click(wrapper);

  expect(tip()?.textContent).toBe("Tip");
});

test("a persisted tooltip shows the updated label when the control is relabeled", () => {
  const { wrapper, relabel } = renderTooltip({ persistOnPress: true });

  hoverTooltipUntilShown(wrapper);
  fireEvent.pointerDown(wrapper, MOUSE);
  fireEvent.click(wrapper);
  relabel("New Label");

  expect(tip()?.textContent).toBe("New Label");
});

test("a persisted tooltip is hidden when the pointer leaves it", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  hoverTooltipUntilShown(wrapper);
  fireEvent.pointerDown(wrapper, MOUSE);
  fireEvent.click(wrapper);
  fireEvent.pointerLeave(wrapper, MOUSE);
  advance(HIDE_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a tap does not show the tooltip", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  tap(wrapper);
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a synthesized mouse event after a tap does not show the tooltip", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  tapWithLateMouseEvent(wrapper);
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a cancelled touch hides the tooltip", () => {
  const { wrapper } = renderTooltip({ persistOnPress: true });

  fireEvent.pointerEnter(wrapper, TOUCH);
  advance(HOVER_DELAY_MS);

  expect(tip()).not.toBeNull();

  fireEvent.pointerCancel(wrapper, TOUCH);

  expect(tip()).toBeNull();
});

test("keyboard focus shows the tooltip without waiting for the hover delay, and blur hides it", () => {
  renderTooltip();
  const control = screen.getByRole("button", { name: "Control" });

  focusWithKeyboard(control);

  expect(tip()?.textContent).toBe("Tip");

  fireEvent.blur(control);

  expect(tip()).toBeNull();
});

test("a suppressed tooltip does not appear", () => {
  const { wrapper } = renderTooltip({ label: "Next", suppressed: true });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a suppressed tooltip does not appear when suppression is removed", () => {
  const { wrapper, suppress } = renderTooltip({ label: "Next" });

  hoverTooltipUntilShown(wrapper);
  suppress(true);

  expect(tip()).toBeNull();

  suppress(false);

  expect(tip()).toBeNull();
});

test("a control showing transient state shows its tooltip", () => {
  const { setShowsState } = renderTooltip();

  setShowsState(true);

  expect(tip()?.textContent).toBe("Tip");
});

test("a control that stops showing transient state hides its tooltip", () => {
  const { setShowsState } = renderTooltip();

  setShowsState(true);
  setShowsState(false);

  expect(tip()).toBeNull();
});

test("a pointer leaving the control hides the tooltip while it is showing transient state", () => {
  const { wrapper, setShowsState } = renderTooltip();

  hoverTooltipUntilShown(wrapper);
  setShowsState(true);
  fireEvent.pointerLeave(wrapper, MOUSE);
  advance(HIDE_DELAY_MS);

  expect(tip()).toBeNull();
});

test("a pointer inside the control keeps the tooltip visible after the transient state clears", () => {
  const { wrapper, setShowsState, relabel } = renderTooltip();

  hoverTooltipUntilShown(wrapper);
  setShowsState(true);
  relabel("Copied");
  setShowsState(false);
  relabel("Tip");

  expect(tip()?.textContent).toBe("Tip");
});

test("`onDidHide` is called when a tooltip that was on screen is hidden", () => {
  const onDidHide = vi.fn();
  const { wrapper } = renderTooltip({ onDidHide });

  hoverTooltipUntilShown(wrapper);

  expect(onDidHide).not.toHaveBeenCalled();

  fireEvent.pointerLeave(wrapper, MOUSE);

  expect(onDidHide).not.toHaveBeenCalled(); // Still on screen for the hide delay.

  advance(HIDE_DELAY_MS);

  expect(onDidHide).toHaveBeenCalledOnce();
});

test("`onDidHide` is not called for a tooltip that was never shown", () => {
  const onDidHide = vi.fn();
  const { wrapper } = renderTooltip({ onDidHide });

  fireEvent.pointerEnter(wrapper, MOUSE);
  advance(HOVER_DELAY_MS - 1);
  fireEvent.pointerLeave(wrapper, MOUSE);
  advance(HOVER_DELAY_MS + HIDE_DELAY_MS);

  expect(onDidHide).not.toHaveBeenCalled();
});

test("`onDidHide` is called when a visible tooltip is suppressed", () => {
  const onDidHide = vi.fn();
  const { wrapper, suppress } = renderTooltip({ onDidHide });

  hoverTooltipUntilShown(wrapper);
  suppress(true);

  expect(onDidHide).toHaveBeenCalledOnce();
});

test("`onDidHide` is called when a visible tooltip unmounts", () => {
  const onDidHide = vi.fn();
  const { wrapper, unmount } = renderTooltip({ onDidHide });

  hoverTooltipUntilShown(wrapper);
  unmount();

  expect(onDidHide).toHaveBeenCalledOnce();
});

test("a sibling control skips the hover delay within the group's grace period", () => {
  const { first, second } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(second, MOUSE);
  advance(0);

  expect(tip()?.textContent).toBe("Second");
});

test("the grace period expires after the pointer leaves the group", () => {
  const { first, second } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  advance(HIDE_DELAY_MS);
  advance(GRACE_PERIOD_MS);
  fireEvent.pointerEnter(second, MOUSE);
  advance(HOVER_DELAY_MS - 1);

  expect(tip()).toBeNull();

  advance(1);

  expect(tip()?.textContent).toBe("Second");
});

test("a control outside the group does not skip the hover delay", () => {
  const { first, elsewhere } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(elsewhere, MOUSE);
  advance(HOVER_DELAY_MS - 1);

  expect(tip()).toBeNull();

  advance(1);

  expect(tip()?.textContent).toBe("Elsewhere");
});

test("a grace period is not started when the pointer leaves a control before a tooltip is shown", () => {
  const { first, second } = renderTooltipGroup();

  fireEvent.pointerEnter(first, MOUSE);
  advance(HOVER_DELAY_MS - 1);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(second, MOUSE);
  advance(HOVER_DELAY_MS - 1);

  expect(tip()).toBeNull();

  advance(1);

  expect(tip()?.textContent).toBe("Second");
});

test("a suppressed tooltip does not start a grace period", () => {
  const { first, second } = renderTooltipGroup();
  const { wrapper: lone } = renderTooltip({ label: "Lone", suppressed: true });

  fireEvent.pointerEnter(lone, MOUSE);
  advance(HOVER_DELAY_MS);
  fireEvent.pointerLeave(lone, MOUSE);
  fireEvent.pointerEnter(first, MOUSE);
  advance(HOVER_DELAY_MS - 1);

  expect(tip()).toBeNull();

  advance(1);

  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(second, MOUSE);
  advance(0);

  expect(tip()?.textContent).toBe("Second");
});

test("a tooltip stays on screen while the pointer crosses to a sibling, and is replaced rather than repeated", () => {
  const { first, second } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);

  expect(tip()?.textContent).toBe("First"); // Held over to cover the crossing.

  fireEvent.pointerEnter(second, MOUSE);
  advance(0);

  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(tip()?.textContent).toBe("Second");
});

test("a pointer that leaves and returns to the same control keeps its tooltip on screen", () => {
  const { first } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(first, MOUSE);
  advance(HIDE_DELAY_MS);

  expect(tip()?.textContent).toBe("First");
});

test("crossing to a control outside the group hides the held-over tooltip after the hide delay", () => {
  const { first, elsewhere } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(elsewhere, MOUSE);
  advance(HIDE_DELAY_MS);

  expect(tip()).toBeNull(); // The hide delay is not extended by arriving from outside the group.

  advance(HOVER_DELAY_MS - HIDE_DELAY_MS);

  expect(tip()?.textContent).toBe("Elsewhere");
});

test("a touch does not inherit a mouse hover's grace period", () => {
  const { first, second } = renderTooltipGroup();

  hoverTooltipUntilShown(first);
  fireEvent.pointerLeave(first, MOUSE);
  fireEvent.pointerEnter(second, TOUCH);
  advance(HIDE_DELAY_MS);

  expect(tip()).toBeNull();

  advance(HOVER_DELAY_MS - HIDE_DELAY_MS);

  expect(tip()?.textContent).toBe("Second");
});

// A control that shows its state synchronously does so before the tap's trailing
// pointer events arrive, unlike one that waits on a promise first.
test("a tooltip shown during a tap remains visible after the touch ends", () => {
  const { wrapper, setShowsState } = renderTooltip({ persistOnPress: true });

  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerUp(wrapper, TOUCH);
  setShowsState(true);
  fireEvent.pointerLeave(wrapper, TOUCH);
  advance(HIDE_DELAY_MS);

  expect(tip()?.textContent).toBe("Tip");
});

test("a tooltip shown during a tap remains visible after the synthesized mouse event", () => {
  const { wrapper, setShowsState } = renderTooltip({ persistOnPress: true });

  fireEvent.pointerEnter(wrapper, TOUCH);
  fireEvent.pointerDown(wrapper, TOUCH);
  fireEvent.pointerUp(wrapper, TOUCH);
  fireEvent.pointerLeave(wrapper, TOUCH);
  setShowsState(true);
  fireEvent.pointerEnter(wrapper, MOUSE);
  fireEvent.pointerLeave(wrapper, MOUSE);
  advance(HIDE_DELAY_MS);

  expect(tip()?.textContent).toBe("Tip");
});

test("showing state on one control replaces the tooltip shown by another", () => {
  const { showFirst, showSecond } = renderStateControls();

  showFirst();

  expect(tip()?.textContent).toBe("First");

  showSecond();

  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(tip()?.textContent).toBe("Second");
});

// The tooltip that is being replaced is deregistered as it is hidden. That must not
// deregister the tooltip that replaced it.
test("replacing a tooltip leaves the replacement registered", () => {
  const { showFirst, showSecond, showThird } = renderStateControls();

  showFirst();
  showSecond();
  showThird();

  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(tip()?.textContent).toBe("Third");
});
