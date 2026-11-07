import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createFrameScheduler } from "./frame-scheduler.ts";

/** Fake timers run animation frames on a 16ms interval. */
const FRAME_MS = 16;

beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] }));

afterEach(() => vi.useRealTimers());

test("runs the callback once when scheduled multiple times before the next frame", () => {
  const callback = vi.fn();
  const scheduler = createFrameScheduler(callback);

  scheduler.schedule();
  scheduler.schedule();

  expect(callback).not.toHaveBeenCalled();

  vi.advanceTimersByTime(FRAME_MS);

  expect(callback).toHaveBeenCalledTimes(1);
});

test("runs the callback again when it is scheduled after a run", () => {
  const callback = vi.fn();
  const scheduler = createFrameScheduler(callback);

  scheduler.schedule();
  vi.advanceTimersByTime(FRAME_MS);
  scheduler.schedule();
  vi.advanceTimersByTime(FRAME_MS);

  expect(callback).toHaveBeenCalledTimes(2);
});

test("stopping cancels a pending run and ignores later scheduling", () => {
  const callback = vi.fn();
  const scheduler = createFrameScheduler(callback);

  scheduler.schedule();
  scheduler.stop();
  scheduler.schedule();
  vi.advanceTimersByTime(FRAME_MS * 2);

  expect(callback).not.toHaveBeenCalled();
});
