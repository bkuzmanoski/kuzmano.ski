import { afterEach, describe, expect, test, vi } from "vitest";

import { stubMatchMedia } from "#/test-utils/match-media.ts";

import { applyTheme, subscribeToColorSchemeChange } from "./theme.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("applyTheme", () => {
  test.for(["light", "dark"] as const)(
    "sets the `data-theme` attribute of the root element for the %s theme",
    (theme) => {
      applyTheme(theme);
      expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
    },
  );

  test("removes the `data-theme` attribute of the root element for the system theme", () => {
    applyTheme("dark");
    applyTheme("system");

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("subscribeToColorSchemeChange", () => {
  test("calls the listener when a theme setting is applied", () => {
    stubMatchMedia();

    const onChange = vi.fn();

    subscribeToColorSchemeChange(onChange);
    applyTheme("dark");

    expect(onChange).toHaveBeenCalledOnce();
  });

  test("calls the listener when the system color scheme changes", () => {
    const changeSystemColorScheme = stubMatchMedia();
    const onChange = vi.fn();

    subscribeToColorSchemeChange(onChange);
    changeSystemColorScheme(true);

    expect(onChange).toHaveBeenCalledOnce();
  });

  test("does not call the listener once the returned function has been called", () => {
    const changeSystemColorScheme = stubMatchMedia();
    const onChange = vi.fn();

    subscribeToColorSchemeChange(onChange)();
    applyTheme("dark");
    changeSystemColorScheme(true);

    expect(onChange).not.toHaveBeenCalled();
  });

  test("calls the listener when a theme setting is applied without `matchMedia`", () => {
    const onChange = vi.fn();

    subscribeToColorSchemeChange(onChange);
    applyTheme("dark");

    expect(onChange).toHaveBeenCalledOnce();
  });
});
