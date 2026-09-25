import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { advanceTimersBy } from "#/test-utils/timers.ts";

import { useIdleTimeout } from "./use-idle-timeout.ts";

const DELAY_MS = 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("the timeout fires once the delay passes without input events", () => {
  const onIdle = vi.fn();

  renderHook(() => useIdleTimeout(DELAY_MS, true, onIdle));
  advanceTimersBy(DELAY_MS - 1);

  expect(onIdle).not.toHaveBeenCalled();

  advanceTimersBy(1);

  expect(onIdle).toHaveBeenCalledOnce();
});

test("an input event restarts the delay", () => {
  const onIdle = vi.fn();

  renderHook(() => useIdleTimeout(DELAY_MS, true, onIdle));

  for (const fire of [
    () => document.dispatchEvent(new Event("pointermove")),
    () => document.dispatchEvent(new Event("pointerdown")),
    () => document.dispatchEvent(new Event("keydown")),
    () => document.dispatchEvent(new Event("wheel")),
  ]) {
    advanceTimersBy(DELAY_MS - 1);
    act(() => {
      fire();
    });
  }

  expect(onIdle).not.toHaveBeenCalled();

  advanceTimersBy(DELAY_MS);

  expect(onIdle).toHaveBeenCalledOnce();
});

test("a disabled timeout does not fire until it is enabled and the delay passes", () => {
  const onIdle = vi.fn();
  const { rerender } = renderHook(({ isEnabled }) => useIdleTimeout(DELAY_MS, isEnabled, onIdle), {
    initialProps: { isEnabled: false },
  });

  advanceTimersBy(DELAY_MS * 2);

  expect(onIdle).not.toHaveBeenCalled();

  rerender({ isEnabled: true });
  advanceTimersBy(DELAY_MS);

  expect(onIdle).toHaveBeenCalledOnce();
});

test("unmounting clears the pending timer and stops listening", () => {
  const onIdle = vi.fn();
  const { unmount } = renderHook(() => useIdleTimeout(DELAY_MS, true, onIdle));

  unmount();
  advanceTimersBy(DELAY_MS * 2);

  expect(onIdle).not.toHaveBeenCalled();

  act(() => {
    document.dispatchEvent(new Event("keydown")); // A listener that outlived the effect would restart the timer here.
  });
  advanceTimersBy(DELAY_MS * 2);

  expect(onIdle).not.toHaveBeenCalled();
});
