import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { watchFaviconColorScheme } from "./favicon";

const HREF = "/favicon.svg";

// Stands in for `matchMedia`, which jsdom does not implement, and
// exposes the scheme change the browser would otherwise report.
function stubMatchMedia() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: false,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };

  vi.stubGlobal("matchMedia", () => media);

  return (matches: boolean) => {
    media.matches = matches;

    for (const listener of listeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  };
}

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("watchFaviconColorScheme", () => {
  test("leaves the icon alone until the scheme changes", () => {
    stubMatchMedia();
    const icon = addIcon();

    watchFaviconColorScheme();

    expect(icon.getAttribute("href")).toBe(HREF);
  });

  test.for([
    ["dark", true, `${HREF}?color-scheme=dark`],
    ["light", false, `${HREF}?color-scheme=light`],
  ] as const)("gives the icon a fresh URL for %s", ([, matches, expected]) => {
    const change = stubMatchMedia();
    const icon = addIcon();

    watchFaviconColorScheme();
    change(matches);

    expect(icon.getAttribute("href")).toBe(expected);
  });

  test("keeps one parameter across repeated changes", () => {
    const change = stubMatchMedia();
    const icon = addIcon();

    watchFaviconColorScheme();
    change(true);
    change(false);

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("stops repointing the icon once torn down", () => {
    const change = stubMatchMedia();
    const icon = addIcon();

    watchFaviconColorScheme()();
    change(true);

    expect(icon.getAttribute("href")).toBe(HREF);
  });

  test("does nothing without an SVG icon", () => {
    const change = stubMatchMedia();

    expect(() => {
      watchFaviconColorScheme();
      change(true);
    }).not.toThrow();
  });

  test("does nothing without `matchMedia`", () => {
    const icon = addIcon();

    expect(() => watchFaviconColorScheme()()).not.toThrow();
    expect(icon.getAttribute("href")).toBe(HREF);
  });
});
