import { act } from "@testing-library/react";
import { vi } from "vitest";

/** Advances the fake timers by `durationMs` inside `act`, so the updates their callbacks make are rendered. */
export const advanceTimersBy = (durationMs: number) =>
  act(() => {
    vi.advanceTimersByTime(durationMs);
  });

/** Resolves after the next animation frame, inside `act`, so the updates its callbacks make are rendered. */
export const nextAnimationFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
