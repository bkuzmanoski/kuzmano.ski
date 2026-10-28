import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE,
  STARTUP_SEQUENCE_THEME_COLOR_SELECTOR,
} from "#/lib/startup-sequence/overlay.ts";
import { STARTUP_SEQUENCE_STORAGE_KEY } from "#/lib/startup-sequence/session.ts";
import appearanceScript from "#/scripts/appearance.ts?inline-script";
import devicePixelRatioScript from "#/scripts/device-pixel-ratio.ts?inline-script";
import startupSequenceScript from "#/scripts/startup-sequence.ts?inline-script";
import themeTintScript from "#/scripts/theme-tint.ts?inline-script";
import webShareScript from "#/scripts/web-share.ts?inline-script";
import { stubMatchMedia } from "#/test-utils/match-media.ts";
import { runScript } from "#/test-utils/script.ts";

// These tests evaluate the bundled scripts exactly as the browser receives them, covering the
// plugin, tree-shaking, minification, and runtime behavior. Attribute names are intentionally
// defined inline because they must match the strings used by the stylesheet.

const themeColorMedia = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => meta.getAttribute("media"));

function setThemeColorMetaTags() {
  document.head.innerHTML = `
    <meta data-startup-sequence-theme-color data-color-scheme="light" name="theme-color" media="(prefers-color-scheme: light)" content="#2e373c" />
    <meta data-startup-sequence-theme-color data-color-scheme="dark" name="theme-color" media="(prefers-color-scheme: dark)" content="#232a2f" />
    <meta data-desktop-background-theme-color data-color-scheme="light" name="theme-color" media="(prefers-color-scheme: light)" content="#e3e7ea" />
    <meta data-desktop-background-theme-color data-color-scheme="dark" name="theme-color" media="(prefers-color-scheme: dark)" content="#151a1d" />
  `;
}

function startupThemeColors() {
  return document.querySelectorAll(STARTUP_SEQUENCE_THEME_COLOR_SELECTOR);
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-appearance");
  document.documentElement.removeAttribute("data-theme-color");
  document.documentElement.style.removeProperty("--theme-chroma-scale");
  document.documentElement.removeAttribute(STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE);
  document.documentElement.removeAttribute("data-web-share");
  document.documentElement.style.removeProperty("--device-pixel-ratio");
  sessionStorage.removeItem(STARTUP_SEQUENCE_STORAGE_KEY);
  localStorage.clear();
  document.head.replaceChildren();
});

describe("appearance", () => {
  test.for(["light", "dark"])("applies a stored %s appearance setting", (appearance) => {
    localStorage.setItem("appearance", appearance);
    runScript(appearanceScript);

    expect(document.documentElement.getAttribute("data-appearance")).toBe(appearance);
  });

  test.for([
    ["light", ["all", "not all", "all", "not all"]],
    ["dark", ["not all", "all", "not all", "all"]],
  ] as const)(
    "sets the `media` attribute of each `theme-color` to match only in the color scheme of a stored %s appearance setting",
    ([appearance, media]) => {
      setThemeColorMetaTags();
      localStorage.setItem("appearance", appearance);
      runScript(appearanceScript);

      expect(themeColorMedia()).toEqual(media);
    },
  );

  test("leaves the `media` attribute of each `theme-color` unchanged when there is no stored appearance", () => {
    setThemeColorMetaTags();
    runScript(appearanceScript);

    expect(themeColorMedia()).toEqual([
      "(prefers-color-scheme: light)",
      "(prefers-color-scheme: dark)",
      "(prefers-color-scheme: light)",
      "(prefers-color-scheme: dark)",
    ]);
  });

  test.for([
    ["there is no stored appearance", null],
    ["the stored appearance is the system appearance", "system"],
    ["the stored appearance is unrecognized", "sepia"],
  ] as const)("leaves the `data-appearance` attribute unset when %s", ([, stored]) => {
    if (stored !== null) {
      localStorage.setItem("appearance", stored);
    }

    runScript(appearanceScript);

    expect(document.documentElement.hasAttribute("data-appearance")).toBe(false);
  });
});

describe("theme tint", () => {
  const rootStyleProperty = (property: string) => document.documentElement.style.getPropertyValue(property);

  test("applies a stored theme color and chroma scale to `<html>`", () => {
    localStorage.setItem("theme-color", "green");
    localStorage.setItem("theme-chroma-scale", "1.5");
    runScript(themeTintScript);

    expect(document.documentElement.getAttribute("data-theme-color")).toBe("green");
    expect(rootStyleProperty("--theme-chroma-scale")).toBe("1.5");
  });

  test("leaves `<html>` unchanged when the stored theme color is unrecognized and the stored chroma scale is not a step of its range", () => {
    localStorage.setItem("theme-color", "teal");
    localStorage.setItem("theme-chroma-scale", "9");
    runScript(themeTintScript);

    expect(document.documentElement.hasAttribute("data-theme-color")).toBe(false);
    expect(rootStyleProperty("--theme-chroma-scale")).toBe("");
  });

  describe("desktop background theme colors", () => {
    beforeEach(() => {
      setThemeColorMetaTags();
      localStorage.setItem("desktop-background-theme-color-light", "oklch(0.925 0.0087 139)");
      localStorage.setItem("desktop-background-theme-color-dark", "oklch(0.215 0.0134 139)");
    });

    const desktopBackgroundThemeColors = () =>
      [...document.querySelectorAll<HTMLMetaElement>("meta[data-desktop-background-theme-color]")].map(
        (meta) => meta.content,
      );

    test("sets the desktop background theme colors to the stored ones when a theme color is stored", () => {
      localStorage.setItem("theme-color", "green");
      runScript(themeTintScript);

      expect(desktopBackgroundThemeColors()).toEqual(["oklch(0.925 0.0087 139)", "oklch(0.215 0.0134 139)"]);
    });

    test("leaves the desktop background theme colors unchanged when neither a theme color nor a chroma scale is stored", () => {
      runScript(themeTintScript);
      expect(desktopBackgroundThemeColors()).toEqual(["#e3e7ea", "#151a1d"]);
    });
  });
});

describe("startup sequence", () => {
  test("enables the overlay when the startup sequence has not run in this session", () => {
    runScript(startupSequenceScript);
    expect(document.documentElement.getAttribute(STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE)).toBe("");
  });

  test("does not enable the overlay when the startup sequence has already run in this session", () => {
    sessionStorage.setItem(STARTUP_SEQUENCE_STORAGE_KEY, "1");
    runScript(startupSequenceScript);

    expect(document.documentElement.hasAttribute(STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE)).toBe(false);
  });
});

describe("startup sequence theme colors", () => {
  beforeEach(() => {
    setThemeColorMetaTags();
  });

  test("retains the theme colors when the startup sequence has not run in this session", () => {
    runScript(startupSequenceScript);
    expect(startupThemeColors()).toHaveLength(2);
  });

  test("removes the theme colors when the startup sequence has already run in this session", () => {
    sessionStorage.setItem(STARTUP_SEQUENCE_STORAGE_KEY, "1");
    runScript(startupSequenceScript);

    expect(startupThemeColors()).toHaveLength(0);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(2);
  });
});

describe("Web Share support", () => {
  test("marks `<html>` with the `data-web-share` attribute when the browser supports the Web Share API", () => {
    Object.defineProperty(navigator, "share", { value: () => Promise.resolve(), configurable: true });

    try {
      runScript(webShareScript);
      expect(document.documentElement.hasAttribute("data-web-share")).toBe(true);
    } finally {
      Reflect.deleteProperty(navigator, "share");
    }
  });

  test("leaves the `data-web-share` attribute unset when the browser does not support the Web Share API", () => {
    runScript(webShareScript);
    expect(document.documentElement.hasAttribute("data-web-share")).toBe(false);
  });
});

describe("device pixel ratio", () => {
  const devicePixelRatioProperty = () => document.documentElement.style.getPropertyValue("--device-pixel-ratio");

  test("sets the `--device-pixel-ratio` custom property of `<html>` to the device pixel ratio", () => {
    stubMatchMedia();
    vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1.1);
    runScript(devicePixelRatioScript);

    expect(devicePixelRatioProperty()).toBe("1.1");
  });

  test("updates the `--device-pixel-ratio` custom property when the device pixel ratio changes", () => {
    const changeResolution = stubMatchMedia();
    const devicePixelRatio = vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1);

    runScript(devicePixelRatioScript);
    devicePixelRatio.mockReturnValue(2);
    changeResolution(false);

    expect(devicePixelRatioProperty()).toBe("2");
  });

  test("updates the `--device-pixel-ratio` custom property on a second change of the device pixel ratio", () => {
    const changeResolution = stubMatchMedia();
    const devicePixelRatio = vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1);

    runScript(devicePixelRatioScript);
    devicePixelRatio.mockReturnValue(2);
    changeResolution(false);
    devicePixelRatio.mockReturnValue(3);
    changeResolution(false);

    expect(devicePixelRatioProperty()).toBe("3");
  });
});

describe("storage failures", () => {
  test.for([
    ["startup sequence", startupSequenceScript, STARTUP_SEQUENCE_OVERLAY_ATTRIBUTE],
    ["appearance", appearanceScript, "data-appearance"],
    ["theme tint", themeTintScript, "data-theme-color"],
  ] as const)("the %s script does not throw when storage access fails", ([, script, attribute]) => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied.");
    });

    expect(() => runScript(script)).not.toThrow();
    expect(document.documentElement.hasAttribute(attribute)).toBe(false);
  });
});
