import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { watchFaviconColorScheme } from "./favicon";

const HREF = "/favicon.svg";

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

function stubVisibility() {
  let state: DocumentVisibilityState = "visible";

  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => state);

  return (next: DocumentVisibilityState) => {
    state = next;
    document.dispatchEvent(new Event("visibilitychange"));
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
  vi.restoreAllMocks();
});

describe("watchFaviconColorScheme", () => {
  test.for([
    ["dark", true, `${HREF}?color-scheme=dark`],
    ["light", false, `${HREF}?color-scheme=light`],
  ] as const)("gives the icon an updated URL for a %s color scheme on start", ([, matches, expected]) => {
    const change = stubMatchMedia();

    change(matches);

    const icon = addIcon();

    watchFaviconColorScheme();

    expect(icon.getAttribute("href")).toBe(expected);
  });

  test.for([
    ["dark", true, `${HREF}?color-scheme=dark`],
    ["light", false, `${HREF}?color-scheme=light`],
  ] as const)("gives the icon an updated URL for a %s color scheme when it changes", ([, matches, expected]) => {
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

  test("waits for a hidden tab to become visible before updating the icon", () => {
    stubMatchMedia();

    const show = stubVisibility();
    const icon = addIcon();

    show("hidden");
    watchFaviconColorScheme();

    expect(icon.getAttribute("href")).toBe(HREF);

    show("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("updates to a scheme changed while the tab was hidden", () => {
    const change = stubMatchMedia();
    const show = stubVisibility();
    const icon = addIcon();

    watchFaviconColorScheme();
    show("hidden");
    change(true);

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);

    show("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=dark`);
  });

  test("does not update the icon when the scheme returns to the one already shown", () => {
    const change = stubMatchMedia();
    const show = stubVisibility();
    const icon = addIcon();

    watchFaviconColorScheme();
    show("hidden");
    icon.setAttribute("href", "sentinel");
    change(true);
    change(false);
    show("visible");

    expect(icon.getAttribute("href")).toBe("sentinel");
  });

  test("does not update the icon after teardown", () => {
    const change = stubMatchMedia();
    const show = stubVisibility();
    const icon = addIcon();

    watchFaviconColorScheme()();
    change(true);
    show("hidden");
    show("visible");

    expect(icon.getAttribute("href")).toBe(`${HREF}?color-scheme=light`);
  });

  test("does not throw when the favicon is not an SVG", () => {
    const change = stubMatchMedia();

    expect(() => {
      watchFaviconColorScheme();
      change(true);
    }).not.toThrow();
  });

  test("does not throw or change the favicon href without `matchMedia`", () => {
    const icon = addIcon();

    expect(() => watchFaviconColorScheme()()).not.toThrow();
    expect(icon.getAttribute("href")).toBe(HREF);
  });
});
