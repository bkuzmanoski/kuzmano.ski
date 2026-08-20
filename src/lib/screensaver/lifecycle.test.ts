import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FADE_IN_MS, sleep, useSleepState, wake } from "./lifecycle";

const themeColors = () => document.querySelectorAll('meta[data-screensaver-theme-color][name="theme-color"]');

function getState() {
  const { result } = renderHook(() => useSleepState());
  return () => result.current;
}

function completeFadeIn() {
  act(() => {
    vi.advanceTimersByTime(FADE_IN_MS);
  });
}

describe("screensaver lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty("--color-screensaver-backdrop");
  });

  test("transitions from awake to asleep, then wakes immediately", () => {
    const state = getState();

    expect(state()).toBe("awake");

    act(sleep);

    expect(state()).toBe("falling-asleep");

    completeFadeIn();

    expect(state()).toBe("asleep");

    act(wake);

    expect(state()).toBe("awake");
  });

  test("does not interrupt the transition to asleep", () => {
    const state = getState();

    act(sleep);
    act(wake);

    expect(state()).toBe("falling-asleep");

    completeFadeIn();

    expect(state()).toBe("asleep");

    act(wake);

    expect(state()).toBe("awake");
  });

  test("does not restart the sleep transition when already asleep", () => {
    const state = getState();

    act(sleep);
    completeFadeIn();

    act(sleep);

    expect(state()).toBe("asleep");

    act(wake);
  });

  test("applies the backdrop color to the theme-color meta tag while asleep", () => {
    document.documentElement.style.setProperty("--color-screensaver-backdrop", "#161a1d");

    expect(themeColors()).toHaveLength(0);

    act(sleep);

    expect(themeColors()).toHaveLength(1);
    expect(themeColors()[0]?.getAttribute("content")).toBe("#161a1d");

    completeFadeIn();
    act(wake);

    expect(themeColors()).toHaveLength(0);
  });
});
