import { THEME_DEFAULTS } from "virtual:theme-defaults";
import { afterEach, describe, expect, test, vi } from "vitest";

import { subscribeToColorChange } from "./color-change.ts";
import {
  getSettings,
  resetSettings,
  resetThemeTint,
  setAppearance,
  setSoundEffects,
  setThemeChromaScale,
  setThemeColor,
  watchStoredSettings,
} from "./settings.ts";

const root = document.documentElement;
const stopListeningFunctions: Array<() => void> = [];

afterEach(() => {
  stopListeningFunctions.splice(0).forEach((stopListening) => stopListening());
  setAppearance("system");
  resetThemeTint();
  setSoundEffects("on");
  localStorage.clear();
});

function watch() {
  const stopWatching = watchStoredSettings();

  stopListeningFunctions.push(stopWatching);

  return stopWatching;
}

function storeFromAnotherTab(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
}

function subscribeColorChangeListener() {
  const onColorChange = vi.fn();

  stopListeningFunctions.push(subscribeToColorChange(onColorChange));

  return onColorChange;
}

describe("resetSettings", () => {
  test("returns every setting to its default and removes the stored values", () => {
    setAppearance("dark");
    setThemeColor("green");
    setThemeChromaScale(1.5);
    setSoundEffects("off");
    resetSettings();

    expect(getSettings()).toEqual({
      appearance: "system",
      themeColor: "purple",
      themeChromaScale: THEME_DEFAULTS.chromaScale,
      soundEffects: "on",
    });
    expect(root.hasAttribute("data-appearance")).toBe(false);
    expect(root.hasAttribute("data-theme-color")).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});

describe("watchStoredSettings", () => {
  test("applies the appearance, theme color, chroma scale, and sound effects setting another tab stores", () => {
    watch();
    storeFromAnotherTab("appearance", "dark");
    storeFromAnotherTab("theme-color", "green");
    storeFromAnotherTab("theme-chroma-scale", "1.5");
    storeFromAnotherTab("sound", "off");

    expect(getSettings()).toEqual({
      appearance: "dark",
      themeColor: "green",
      themeChromaScale: 1.5,
      soundEffects: "off",
    });
    expect(root.getAttribute("data-appearance")).toBe("dark");
    expect(root.getAttribute("data-theme-color")).toBe("green");
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("1.5");
  });

  test("restores every setting to its default when another tab clears the storage", () => {
    setAppearance("dark");
    setThemeColor("green");
    setThemeChromaScale(1.5);
    setSoundEffects("off");
    watch();

    expect(root.getAttribute("data-theme-color")).toBe("green");

    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));

    expect(getSettings()).toEqual({
      appearance: "system",
      themeColor: "purple",
      themeChromaScale: THEME_DEFAULTS.chromaScale,
      soundEffects: "on",
    });
    expect(root.hasAttribute("data-appearance")).toBe(false);
    expect(root.hasAttribute("data-theme-color")).toBe(false);
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("");
  });

  test("notifies the color change listeners of a setting another tab stores", () => {
    watch();

    const onColorChange = subscribeColorChangeListener();

    storeFromAnotherTab("theme-color", "green");

    expect(onColorChange).toHaveBeenCalledTimes(1);
  });

  test("ignores another tab storing a key that the settings do not read", () => {
    watch();

    const onColorChange = subscribeColorChangeListener();

    storeFromAnotherTab("desktop-background-theme-color-light", "#ffffff");

    expect(onColorChange).not.toHaveBeenCalled();
  });

  test("stops applying the settings another tab stores once the watch stops", () => {
    watch()();
    storeFromAnotherTab("theme-color", "green");

    expect(getSettings().themeColor).toBe("purple");
    expect(root.hasAttribute("data-theme-color")).toBe(false);
  });
});
