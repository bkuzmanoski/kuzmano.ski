import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { stubMatchMedia } from "#/test-utils/match-media.ts";

import { computedColorOf } from "../computed-color.ts";

import { watchDesktopBackgroundThemeColors } from "./desktop-background-theme-colors.ts";
import { resetThemeTint, setAppearance, setThemeChromaScale, setThemeColor } from "./settings.ts";

vi.mock("../computed-color.ts", () => ({ computedColorOf: vi.fn() })); // jsdom does not resolve `var()` in a computed color.

let nextAnimationFrameId = 1;

const pendingAnimationFrames = new Map<number, FrameRequestCallback>();
const stopWatchingFunctions: Array<() => void> = [];

const desktopBackgroundThemeColors = () =>
  [...document.querySelectorAll<HTMLMetaElement>("meta[data-desktop-background-theme-color]")].map(
    (meta) => meta.content,
  );

function runAnimationFrames() {
  const callbacks = [...pendingAnimationFrames.values()];

  pendingAnimationFrames.clear();
  callbacks.forEach((callback) => callback(performance.now()));
}

function watch() {
  const stopWatching = watchDesktopBackgroundThemeColors();

  stopWatchingFunctions.push(stopWatching);

  return stopWatching;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingAnimationFrames.set(nextAnimationFrameId, callback);
    return nextAnimationFrameId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (animationFrameId: number) => pendingAnimationFrames.delete(animationFrameId));
  vi.mocked(computedColorOf).mockImplementation((_color, colorScheme) => `${colorScheme}-1`);
  document.head.innerHTML = `
    <meta data-desktop-background-theme-color data-color-scheme="light" name="theme-color" content="#ffffff" />
    <meta data-desktop-background-theme-color data-color-scheme="dark" name="theme-color" content="#000000" />
  `;
});

afterEach(() => {
  stopWatchingFunctions.splice(0).forEach((stopWatching) => stopWatching());
  pendingAnimationFrames.clear();
  vi.unstubAllGlobals();
  vi.mocked(computedColorOf).mockReset();
  setAppearance("system");
  resetThemeTint();
  localStorage.clear();
  document.head.replaceChildren();
});

describe("watchDesktopBackgroundThemeColors", () => {
  test("sets and stores the desktop background theme colors from the computed value of the `--color-desktop-background` custom property in each color scheme on the first animation frame when a theme tint is stored", () => {
    localStorage.setItem("theme-color", "green");
    watch();

    expect(computedColorOf).not.toHaveBeenCalled();

    runAnimationFrames();

    expect(computedColorOf).toHaveBeenCalledWith("var(--color-desktop-background)", "light");
    expect(computedColorOf).toHaveBeenCalledWith("var(--color-desktop-background)", "dark");
    expect(desktopBackgroundThemeColors()).toEqual(["light-1", "dark-1"]);
    expect(localStorage.getItem("desktop-background-theme-color-light")).toBe("light-1");
    expect(localStorage.getItem("desktop-background-theme-color-dark")).toBe("dark-1");
  });

  test("leaves the desktop background theme colors unchanged when a theme tint is not stored", () => {
    watch();
    runAnimationFrames();

    expect(computedColorOf).not.toHaveBeenCalled();
    expect(desktopBackgroundThemeColors()).toEqual(["#ffffff", "#000000"]);
    expect(localStorage.getItem("desktop-background-theme-color-light")).toBeNull();
  });

  test("reads the colors once on the animation frame after several theme tint changes", () => {
    watch();
    runAnimationFrames();
    vi.mocked(computedColorOf).mockImplementation((_color, colorScheme) => `${colorScheme}-2`);
    setThemeColor("green");
    setThemeChromaScale(1.5);

    expect(computedColorOf).not.toHaveBeenCalled();

    runAnimationFrames();

    expect(computedColorOf).toHaveBeenCalledTimes(2);
    expect(desktopBackgroundThemeColors()).toEqual(["light-2", "dark-2"]);
  });

  test("does not read the colors again after a change of appearance or of the system color scheme", () => {
    const changeSystemColorScheme = stubMatchMedia();

    localStorage.setItem("theme-color", "green");
    watch();
    runAnimationFrames();
    vi.mocked(computedColorOf).mockClear();
    setAppearance("dark");
    changeSystemColorScheme(true);

    expect(pendingAnimationFrames.size).toBe(1);

    runAnimationFrames();

    expect(computedColorOf).not.toHaveBeenCalled();
  });

  test("stopping the watch cancels a pending update and stops listening for theme tint changes", () => {
    const stopWatching = watch();

    runAnimationFrames();
    setThemeColor("green");
    stopWatching();
    setThemeChromaScale(1.5);
    runAnimationFrames();

    expect(computedColorOf).not.toHaveBeenCalled();
  });
});
