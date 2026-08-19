import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useIdleTimeout } from "./use-idle-timeout";

const DELAY_MS = 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

test("fires once the delay passes with no input events", () => {
  const onIdle = vi.fn();

  renderHook(() => useIdleTimeout(DELAY_MS, true, onIdle));
  wait(DELAY_MS - 1);

  expect(onIdle).not.toHaveBeenCalled();

  wait(1);

  expect(onIdle).toHaveBeenCalledOnce();
});

test("starts the delay over when an input event is fired", () => {
  const onIdle = vi.fn();

  renderHook(() => useIdleTimeout(DELAY_MS, true, onIdle));

  for (const fire of [
    () => document.dispatchEvent(new Event("pointermove")),
    () => document.dispatchEvent(new Event("pointerdown")),
    () => document.dispatchEvent(new Event("keydown")),
    () => document.dispatchEvent(new Event("wheel")),
  ]) {
    wait(DELAY_MS - 1);
    act(() => {
      fire();
    });
  }

  expect(onIdle).not.toHaveBeenCalled();

  wait(DELAY_MS);

  expect(onIdle).toHaveBeenCalledOnce();
});

test("does not fire when disabled", () => {
  const onIdle = vi.fn();
  const { rerender } = renderHook(({ isEnabled }) => useIdleTimeout(DELAY_MS, isEnabled, onIdle), {
    initialProps: { isEnabled: false },
  });

  wait(DELAY_MS * 2);

  expect(onIdle).not.toHaveBeenCalled();

  rerender({ isEnabled: true });
  wait(DELAY_MS);

  expect(onIdle).toHaveBeenCalledOnce();
});
