import { beforeEach, describe, expect, test } from "vitest";

import { stubMatchMedia } from "#/test-utils/match-media.ts";
import { stubVisibilityState } from "#/test-utils/visibility.ts";

import { watchFaviconColorScheme } from "./favicon.ts";

const HREF = "/favicon.svg";

function addIcon() {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.setAttribute("href", HREF);

  document.head.append(icon);

  return icon;
}

beforeEach(() => {
  document.head.replaceChildren();
});

describe("watchFaviconColorScheme", () => {
  test.for([
    ["dark", true, `${HREF}?color-scheme=dark`],
    ["light", false, `${HREF}?color-scheme=light`],
  ] as const)("sets the icon's `href` attribute for a %s color scheme on start", ([, matches, expected]) => {
    const change = stubMatchMedia();

    change(matches);

    const icon = addIcon();

    watchFaviconColorScheme();

    expect(icon.getAttribute("href")).toBe(expected);
  });

  test.for([
    ["dark", true, `${HREF}?color-scheme=dark`],
    ["light", false, `${HREF}?color-scheme=light`],
  ] as const)(
    "sets the icon's `href` attribute for a %s color scheme when the scheme changes",
    ([, matches, expected]) => {
      const change = stubMatchMedia();
      const icon = addIcon();

      watchFaviconColorScheme();
      change(matches);

      expect(icon.getAttribute("href")).toBe(expected);
    },
  );

  test("replaces the color scheme parameter on each change rather than appending another", () => {
    const change = stubMatchMedia();
    const icon = addIcon();

    watchFaviconColorScheme();
    change(true);
    change(false);

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("waits for a hidden tab to become visible before updating the icon", () => {
    stubMatchMedia();

    const setVisibilityState = stubVisibilityState();
    const icon = addIcon();

    setVisibilityState("hidden");
    watchFaviconColorScheme();

    expect(icon.getAttribute("href")).toBe(HREF);

    setVisibilityState("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("updates to a scheme changed while the tab was hidden", () => {
    const change = stubMatchMedia();
    const setVisibilityState = stubVisibilityState();
    const icon = addIcon();

    watchFaviconColorScheme();
    setVisibilityState("hidden");
    change(true);

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);

    setVisibilityState("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=dark`);
  });

  test("does not update the icon when the scheme returns to the one already shown", () => {
    const change = stubMatchMedia();
    const setVisibilityState = stubVisibilityState();
    const icon = addIcon();

    watchFaviconColorScheme();
    setVisibilityState("hidden");
    icon.setAttribute("href", "sentinel");
    change(true);
    change(false);
    setVisibilityState("visible");

    expect(icon.getAttribute("href")).toBe("sentinel");
  });

  test("does not update the icon after teardown", () => {
    const change = stubMatchMedia();
    const setVisibilityState = stubVisibilityState();
    const icon = addIcon();

    watchFaviconColorScheme()();
    change(true);
    setVisibilityState("hidden");
    setVisibilityState("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("does not throw when the document has no SVG favicon", () => {
    const change = stubMatchMedia();

    expect(() => {
      watchFaviconColorScheme();
      change(true);
    }).not.toThrow();
  });

  test("does not throw or change the icon's `href` attribute without `matchMedia`", () => {
    const icon = addIcon();

    expect(() => watchFaviconColorScheme()()).not.toThrow();
    expect(icon.getAttribute("href")).toBe(HREF);
  });
});
