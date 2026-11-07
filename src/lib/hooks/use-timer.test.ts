import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useTimers } from "./use-timer.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("`useTimers` reports a timer as pending until it fires", () => {
  const { result } = renderHook(() => useTimers());

  result.current.add(() => undefined, 100);
  result.current.add(() => undefined, 200);
  vi.advanceTimersByTime(100);

  expect(result.current.isPending()).toBe(true);

  vi.advanceTimersByTime(100);

  expect(result.current.isPending()).toBe(false);
});

test("`useTimers` cancels every pending timer on unmount", () => {
  const callback = vi.fn();
  const { result, unmount } = renderHook(() => useTimers());

  result.current.add(callback, 100);
  unmount();
  vi.advanceTimersByTime(100);

  expect(callback).not.toHaveBeenCalled();
});
