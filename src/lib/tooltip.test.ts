import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  GRACE_PERIOD_MS,
  HIDE_DELAY_MS,
  hideAfterDelay,
  isGroupInGracePeriod,
  registerShownTooltip,
  resetGroupGracePeriod,
  resetTooltipState,
  runPendingHideAction,
  startGroupGracePeriod,
  unregisterShownTooltip,
} from "./tooltip.ts";

beforeEach(() => {
  vi.useFakeTimers();
  resetTooltipState();
});

afterEach(() => vi.useRealTimers());

// The grace period is keyed on the parent of a control's wrapper, so a group is two wrappers sharing one.
function createGroup() {
  const group = document.createElement("div");
  const wrapper = () => group.appendChild(document.createElement("span"));

  return { first: wrapper(), second: wrapper() };
}

function show(id: string) {
  const hideAction = vi.fn();
  registerShownTooltip(id, hideAction);

  return hideAction;
}

describe("the tooltip on screen", () => {
  test("showing a tooltip hides the one it replaces", () => {
    const hideFirst = show("first");

    show("second");

    expect(hideFirst).toHaveBeenCalledOnce();
  });

  test("a tooltip registering again under its own id stays on screen", () => {
    const hideFirst = show("first");

    show("first");

    expect(hideFirst).not.toHaveBeenCalled();
  });

  test("a tooltip that has unregistered is not hidden by the next one to appear", () => {
    const hideFirst = show("first");

    unregisterShownTooltip("first");
    show("second");

    expect(hideFirst).not.toHaveBeenCalled();
  });

  // A replaced tooltip unregisters as its effect is torn down, which happens
  // after the tooltip that replaced it has already registered.
  test("a replaced tooltip cannot unregister its replacement", () => {
    show("first");

    const hideSecond = show("second");

    unregisterShownTooltip("first");
    show("third");

    expect(hideSecond).toHaveBeenCalledOnce();
  });
});

describe("deferred hides", () => {
  test("a scheduled hide runs after the hide delay", () => {
    const hide = vi.fn();

    hideAfterDelay(hide);
    vi.advanceTimersByTime(HIDE_DELAY_MS - 1);

    expect(hide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(hide).toHaveBeenCalledOnce();
  });

  // Deferring both hides would leave two tooltips on screen at once.
  test("scheduling a second hide runs the first immediately", () => {
    const hideFirst = vi.fn();

    hideAfterDelay(hideFirst);
    hideAfterDelay(vi.fn());

    expect(hideFirst).toHaveBeenCalledOnce();
  });

  test("a hide that has already run is not repeated when its delay elapses", () => {
    const hide = vi.fn();

    hideAfterDelay(hide);
    runPendingHideAction();
    vi.advanceTimersByTime(HIDE_DELAY_MS);

    expect(hide).toHaveBeenCalledOnce();
  });
});

describe("the group grace period", () => {
  test("a sibling of the control whose tooltip was last shown is in the grace period", () => {
    const { first, second } = createGroup();

    resetGroupGracePeriod("first", first);

    expect(isGroupInGracePeriod(second)).toBe(true);
  });

  test.each([
    ["a control with no wrapper", () => null],
    ["a control in another group", () => createGroup().first],
  ])("%s is outside the grace period", (_label, wrapper) => {
    const { first } = createGroup();

    resetGroupGracePeriod("first", first);

    expect(isGroupInGracePeriod(wrapper())).toBe(false);
  });

  test("the group leaves the grace period once the grace period has elapsed since its tooltip hid", () => {
    const { first, second } = createGroup();

    resetGroupGracePeriod("first", first);
    startGroupGracePeriod("first");
    vi.advanceTimersByTime(GRACE_PERIOD_MS - 1);

    expect(isGroupInGracePeriod(second)).toBe(true);

    vi.advanceTimersByTime(1);

    expect(isGroupInGracePeriod(second)).toBe(false);
  });

  test("hiding a second tooltip in the group measures the grace period from the later hide", () => {
    const { first, second } = createGroup();

    resetGroupGracePeriod("first", first);
    startGroupGracePeriod("first");
    vi.advanceTimersByTime(GRACE_PERIOD_MS - 1);
    resetGroupGracePeriod("second", second);
    startGroupGracePeriod("second");
    vi.advanceTimersByTime(GRACE_PERIOD_MS - 1);

    expect(isGroupInGracePeriod(second)).toBe(true);

    vi.advanceTimersByTime(1);

    expect(isGroupInGracePeriod(second)).toBe(false);
  });

  test("showing a tooltip in the group cancels the pending expiry of the grace period", () => {
    const { first, second } = createGroup();

    resetGroupGracePeriod("first", first);
    startGroupGracePeriod("first");
    resetGroupGracePeriod("second", second);
    vi.advanceTimersByTime(GRACE_PERIOD_MS);

    expect(isGroupInGracePeriod(first)).toBe(true);
  });

  test("hiding a tooltip that a later one replaced leaves the later tooltip's grace period running", () => {
    const { first, second } = createGroup();

    // The replacement registers before the tooltip it replaces hides, so the earlier hide must not
    // schedule an expiry against the grace period the replacement now owns.
    resetGroupGracePeriod("first", first);
    resetGroupGracePeriod("second", second);
    startGroupGracePeriod("first");
    vi.advanceTimersByTime(GRACE_PERIOD_MS);

    expect(isGroupInGracePeriod(second)).toBe(true);
  });
});
