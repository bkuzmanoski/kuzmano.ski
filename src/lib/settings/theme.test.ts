import { afterEach, describe, expect, test } from "vitest";

import { DEFAULT_THEME_CHROMA_SCALE, DEFAULT_THEME_COLOR } from "./theme-tint.ts";
import { applyAppearance, applyDesktopBackgroundThemeColor, applyThemeTint, themeChromaScaleFrom } from "./theme.ts";

const root = document.documentElement;

afterEach(() => {
  root.removeAttribute("data-appearance");
  root.removeAttribute("style");
  document.head.replaceChildren();
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
  test("sets the `--theme-hue`, `--color-accent`, and `--theme-chroma-scale` custom properties of the root element", () => {
    applyThemeTint({ themeColor: "green", chromaScale: 1.5 });

    expect(root.style.getPropertyValue("--theme-hue")).toBe("var(--accent-green-hue)");
    expect(root.style.getPropertyValue("--color-accent")).toBe("var(--accent-green)");
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("1.5");
  });

  test("resets each custom property to its default for `null`, and leaves it unchanged for `undefined`", () => {
    applyThemeTint({ themeColor: "green", chromaScale: 1.5 });
    applyThemeTint({ chromaScale: null });

    expect(root.style.getPropertyValue("--color-accent")).toBe("var(--accent-green)");
    expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe(String(DEFAULT_THEME_CHROMA_SCALE));

    applyThemeTint({ themeColor: null });

    expect(root.style.getPropertyValue("--theme-hue")).toBe(`var(--accent-${DEFAULT_THEME_COLOR}-hue)`);
    expect(root.style.getPropertyValue("--color-accent")).toBe(`var(--accent-${DEFAULT_THEME_COLOR})`);
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
