import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { ACCENT_COLOR_NAMES } from "../accent-colors.ts";

import {
  DEFAULT_THEME_COLOR,
  applyAppearance,
  applyDesktopBackgroundThemeColor,
  applyThemeTint,
  themeChromaScaleFrom,
} from "./theme.ts";

const root = document.documentElement;

afterEach(() => {
  vi.unstubAllGlobals();
  root.removeAttribute("data-appearance");
  root.removeAttribute("data-theme-color");
  root.removeAttribute("style");
  document.head.replaceChildren();
});

describe("data-theme-color", () => {
  test("`/src/styles.css` declares a `data-theme-color` rule for each accent color other than the default, and only those", () => {
    const stylesheet = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    const declaredThemeColors = [...stylesheet.matchAll(/\[data-theme-color="([a-z]+)"\]/g)].map((match) => match[1]);

    expect(declaredThemeColors.sort()).toEqual(
      ACCENT_COLOR_NAMES.filter((accentColorName) => accentColorName !== DEFAULT_THEME_COLOR).sort(),
    );
  });
});

describe("applyAppearance", () => {
  test.for(["light", "dark"] as const)(
    "sets the `data-appearance` attribute of the root element for the %s appearance",
    (appearance) => {
      applyAppearance(appearance);
      expect(root.getAttribute("data-appearance")).toBe(appearance);
    },
  );

  test("removes the `data-appearance` attribute of the root element for the system appearance", () => {
    applyAppearance("dark");
    applyAppearance("system");

    expect(root.hasAttribute("data-appearance")).toBe(false);
  });

  test("sets the `media` attribute of each `theme-color` to match only in the color scheme of the appearance, and restores the system color scheme queries for the system appearance", () => {
    document.head.innerHTML = `
      <meta data-color-scheme="light" name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
      <meta data-color-scheme="dark" name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
    `;

    const media = () => [...document.querySelectorAll("meta")].map((meta) => meta.getAttribute("media"));

    applyAppearance("dark");

    expect(media()).toEqual(["not all", "all"]);

    applyAppearance("system");

    expect(media()).toEqual(["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]);
  });
});

describe("applyThemeTint", () => {
  test("sets the `data-theme-color` attribute and the `--theme-chroma-scale` custom property of the root element", () => {
    applyThemeTint({ themeColor: "green", chromaScale: 1.5 });

    expect(root.getAttribute("data-theme-color")).toBe("green");
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("1.5");
  });

  test("removes the `data-theme-color` attribute for the default theme color", () => {
    applyThemeTint({ themeColor: "green" });
    applyThemeTint({ themeColor: "purple" });

    expect(root.hasAttribute("data-theme-color")).toBe(false);
  });

  test("removes the attribute and the custom property for `null`, and leaves either unchanged for `undefined`", () => {
    applyThemeTint({ themeColor: "green", chromaScale: 1.5 });
    applyThemeTint({ chromaScale: null });

    expect(root.getAttribute("data-theme-color")).toBe("green");
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("");

    applyThemeTint({ themeColor: null });

    expect(root.hasAttribute("data-theme-color")).toBe(false);
  });
});

describe("applyDesktopBackgroundThemeColor", () => {
  test("sets the `content` attribute of the desktop background `theme-color` for the color scheme, and leaves it unchanged for `null`", () => {
    document.head.innerHTML = `
      <meta data-startup-sequence-theme-color data-color-scheme="light" name="theme-color" content="#111111" />
      <meta data-desktop-background-theme-color data-color-scheme="light" name="theme-color" content="#ffffff" />
      <meta data-desktop-background-theme-color data-color-scheme="dark" name="theme-color" content="#000000" />
    `;
    applyDesktopBackgroundThemeColor("light", "oklch(0.925 0.0087 139)");
    applyDesktopBackgroundThemeColor("dark", null);

    const contents = [...document.querySelectorAll("meta")].map((meta) => meta.content);

    expect(contents).toEqual(["#111111", "oklch(0.925 0.0087 139)", "#000000"]);
  });
});

describe("themeChromaScaleFrom", () => {
  test.for([
    ["0", 0],
    ["1.25", 1.25],
    ["2.5", 2.5],
  ] as const)("returns the number for a stored chroma scale of `%s`", ([rawValue, chromaScale]) => {
    expect(themeChromaScaleFrom(rawValue)).toBe(chromaScale);
  });

  test.for(["1.1", "2.75", "-0.25", " "])("returns `null` for a stored chroma scale of `%s`", (rawValue) => {
    expect(themeChromaScaleFrom(rawValue)).toBeNull();
  });

  test("returns `null` when there is no stored chroma scale", () => {
    expect(themeChromaScaleFrom(null)).toBeNull();
  });
});
