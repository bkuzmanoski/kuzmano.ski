import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createFrameScheduler, loopAnimationFrames } from "./animation-frames.ts";

/** Fake timers run animation frames on a 16ms interval. */
const FRAME_MS = 16;

beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] }));

afterEach(() => vi.useRealTimers());

describe("createFrameScheduler", () => {
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

  test("does not run the callback for a call to `schedule` before or after `stop`", () => {
    const callback = vi.fn();
    const scheduler = createFrameScheduler(callback);

    scheduler.schedule();
    scheduler.stop();
    scheduler.schedule();
    vi.advanceTimersByTime(FRAME_MS * 2);

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("loopAnimationFrames", () => {
  test("runs the callback on every animation frame until the returned function stops the loop", () => {
    const onFrame = vi.fn();
    const stop = loopAnimationFrames(onFrame);

    vi.advanceTimersByTime(FRAME_MS * 3);

    expect(onFrame).toHaveBeenCalledTimes(3);

    stop();
    vi.advanceTimersByTime(FRAME_MS * 2);

    expect(onFrame).toHaveBeenCalledTimes(3);
  });

  test("passes the callback the timestamp of each frame", () => {
    const timestamps: Array<number> = [];
    const stop = loopAnimationFrames((now) => timestamps.push(now));

    vi.advanceTimersByTime(FRAME_MS * 2);
    stop();

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1]! - timestamps[0]!).toBe(FRAME_MS);
  });

  test("does not request another frame after the callback stops the loop", () => {
    const onFrame = vi.fn();
    const stop = loopAnimationFrames(onFrame);

    onFrame.mockImplementation(stop);
    vi.advanceTimersByTime(FRAME_MS * 3);

    expect(onFrame).toHaveBeenCalledTimes(1);
  });
});
