import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { computedColorOf } from "../computed-color.ts";

import { FADE_IN_DURATION_MS, sleep, sleepOnIdle, useSleepState, wake } from "./lifecycle.ts";

vi.mock("../computed-color.ts", () => ({ computedColorOf: vi.fn(() => "oklch(0.215 0.0134 257)") })); // jsdom does not resolve `var()` in a computed color.

const themeColors = () => document.querySelectorAll('meta[data-screensaver-theme-color][name="theme-color"]');

function getState() {
  const { result } = renderHook(() => useSleepState());
  return () => result.current;
}

function openAlert() {
  const alert = document.createElement("dialog");
  document.body.append(alert);
  alert.showModal();

  return alert;
}

function completeFadeIn() {
  act(() => {
    vi.advanceTimersByTime(FADE_IN_DURATION_MS);
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

  test("ignores `wake` until the fade-in completes", () => {
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

  test("prevents idle sleep while an alert is open", () => {
    const state = getState();
    const alert = openAlert();

    act(sleepOnIdle);

    expect(state()).toBe("awake");

    alert.remove();
  });

  test("sleeps on idle once the alert has been dismissed", () => {
    const state = getState();
    const alert = openAlert();
    alert.close();

    act(sleepOnIdle);

    expect(state()).toBe("falling-asleep");

    completeFadeIn();
    act(wake);
    alert.remove();
  });

  test("adds a `theme-color` `<meta>` with the computed value of the `--color-screensaver-backdrop` custom property on `sleep`, and removes it on `wake`", () => {
    document.documentElement.style.setProperty("--color-screensaver-backdrop", "var(--neutral-215)");

    expect(themeColors()).toHaveLength(0);

    act(sleep);

    expect(computedColorOf).toHaveBeenCalledWith("var(--color-screensaver-backdrop)");
    expect(themeColors()).toHaveLength(1);
    expect(themeColors()[0]?.getAttribute("content")).toBe("oklch(0.215 0.0134 257)");

    completeFadeIn();
    act(wake);

    expect(themeColors()).toHaveLength(0);
  });

  test("omits the `theme-color` `<meta>` on `sleep` when the `--color-screensaver-backdrop` custom property is not declared", () => {
    act(sleep);

    expect(themeColors()).toHaveLength(0);

    completeFadeIn();
    act(wake);
  });
});
