import { beforeEach, describe, expect, test, vi } from "vitest";

import { BOOT_SEQUENCE_OVERLAY_ATTRIBUTE, BOOT_SEQUENCE_THEME_COLOR_SELECTOR } from "#/lib/boot-sequence/overlay.ts";
import { BOOT_SEQUENCE_STORAGE_KEY } from "#/lib/boot-sequence/session.ts";
import bootSequenceScript from "#/scripts/boot-sequence.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

// These tests evaluate the bundled scripts exactly as the browser receives them, covering the
// plugin, tree-shaking, minification, and runtime behavior. Attribute names are intentionally
// defined inline because they must match the strings used by the stylesheet.

function run(script: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- Tests the bundle as it would be evaluated in the browser.
  new Function(script)();
}

function setThemeColorMetaTags() {
  const bootLight = document.createElement("meta");
  bootLight.dataset.bootSequenceThemeColor = "";
  bootLight.name = "theme-color";
  bootLight.media = "(prefers-color-scheme: light)";
  bootLight.content = "#2e373c";

  const bootDark = document.createElement("meta");
  bootDark.dataset.bootSequenceThemeColor = "";
  bootDark.name = "theme-color";
  bootDark.media = "(prefers-color-scheme: dark)";
  bootDark.content = "#232a2f";

  const lightThemeColor = document.createElement("meta");
  lightThemeColor.name = "theme-color";
  lightThemeColor.media = "(prefers-color-scheme: light)";
  lightThemeColor.content = "#e3e7ea";

  const darkThemeColor = document.createElement("meta");
  darkThemeColor.name = "theme-color";
  darkThemeColor.media = "(prefers-color-scheme: dark)";
  darkThemeColor.content = "#151a1d";

  document.head.append(bootLight, bootDark, lightThemeColor, darkThemeColor);
}

function bootThemeColors() {
  return document.querySelectorAll(BOOT_SEQUENCE_THEME_COLOR_SELECTOR);
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute(BOOT_SEQUENCE_OVERLAY_ATTRIBUTE);
  sessionStorage.removeItem(BOOT_SEQUENCE_STORAGE_KEY);
  localStorage.clear();
  document.head.replaceChildren();
});

describe("theme", () => {
  test.for(["light", "dark"])("applies a stored %s theme setting", (theme) => {
    localStorage.setItem("theme", theme);
    run(themeScript);

    expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
  });

  test.for([
    ["there is no stored theme", null],
    ["the stored theme is the system theme", "system"],
    ["the stored theme is unrecognized", "sepia"],
  ] as const)("leaves the `data-theme` attribute unset when %s", ([, stored]) => {
    if (stored !== null) {
      localStorage.setItem("theme", stored);
    }

    run(themeScript);

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("boot sequence", () => {
  test("enables the overlay when the boot sequence has not run in this session", () => {
    run(bootSequenceScript);
    expect(document.documentElement.getAttribute(BOOT_SEQUENCE_OVERLAY_ATTRIBUTE)).toBe("");
  });

  test("does not enable the overlay when the boot sequence has already run in this session", () => {
    sessionStorage.setItem(BOOT_SEQUENCE_STORAGE_KEY, "1");
    run(bootSequenceScript);

    expect(document.documentElement.hasAttribute(BOOT_SEQUENCE_OVERLAY_ATTRIBUTE)).toBe(false);
  });
});

describe("boot sequence theme colors", () => {
  beforeEach(() => {
    setThemeColorMetaTags();
  });

  test("retains the theme colors when the boot sequence has not run in this session", () => {
    run(bootSequenceScript);
    expect(bootThemeColors()).toHaveLength(2);
  });

  test("removes the theme colors when the boot sequence has already run in this session", () => {
    sessionStorage.setItem(BOOT_SEQUENCE_STORAGE_KEY, "1");
    run(bootSequenceScript);

    expect(bootThemeColors()).toHaveLength(0);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(2);
  });
});

describe("storage failures", () => {
  test.for([
    ["boot sequence", bootSequenceScript, BOOT_SEQUENCE_OVERLAY_ATTRIBUTE],
    ["theme", themeScript, "data-theme"],
  ] as const)("the %s script does not throw when storage access fails", ([, script, attribute]) => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied.");
    });

    expect(() => run(script)).not.toThrow();
    expect(document.documentElement.hasAttribute(attribute)).toBe(false);
  });
});
