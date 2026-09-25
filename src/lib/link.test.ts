import { describe, expect, test, vi } from "vitest";

import {
  isBrowserHandledClick,
  isRepeatClick,
  isSitePath,
  linkDestinationOf,
  openInAppOnPlainClick,
  sitePathPartsOf,
} from "./link.ts";

import type { MouseEvent } from "react";

const click = (overrides: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    detail: 1,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => undefined,
    ...overrides,
  }) as MouseEvent;

describe("isRepeatClick", () => {
  test("returns `false` for the first press of a sequence", () => {
    expect(isRepeatClick(click({ detail: 1 }))).toBe(false);
  });

  test("returns `true` for every press after the first", () => {
    expect(isRepeatClick(click({ detail: 2 }))).toBe(true);
    expect(isRepeatClick(click({ detail: 3 }))).toBe(true);
  });
});

describe("isBrowserHandledClick", () => {
  test("returns `false` for a primary button press without a modifier key", () => {
    expect(isBrowserHandledClick(click())).toBe(false);
  });

  test("returns `true` for a press with a modifier key", () => {
    expect(isBrowserHandledClick(click({ metaKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ ctrlKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ shiftKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ altKey: true }))).toBe(true);
  });

  test("returns `true` for a non-primary button press", () => {
    expect(isBrowserHandledClick(click({ button: 1 }))).toBe(true);
  });
});

describe("isSitePath", () => {
  test("returns `true` for a path starting with a single `/`", () => {
    expect(isSitePath("/collection/entry")).toBe(true);
  });

  test("returns `true` for a path whose query string contains `//`", () => {
    expect(isSitePath("/collection?next=//example.com")).toBe(true);
  });

  test.each([
    ["a protocol-relative URL", "//example.com/path"],
    ["a path whose second character is a backslash", String.raw`/\example.com/path`],
    ["a path starting with a slash, a backslash, and a slash", String.raw`/\/example.com/path`],
    ["a protocol-relative URL with a tab between its slashes", "/\t/example.com/path"],
    ["a protocol-relative URL with a newline between its slashes", "/\n/example.com/path"],
    ["an absolute URL", "https://example.com/path"],
    ["a relative path", "collection/entry"],
  ])("returns `false` for %s", (_label, value) => {
    expect(isSitePath(value)).toBe(false);
  });
});

describe("openInAppOnPlainClick", () => {
  test("opens the destination in the app and prevents the browser from loading it on a plain click", () => {
    const preventDefault = vi.fn();
    const openInApp = vi.fn();

    openInAppOnPlainClick(click({ preventDefault }), openInApp);

    expect(openInApp).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  test("does not open the destination in the app or prevent the browser from loading it on a click with a modifier key", () => {
    const preventDefault = vi.fn();
    const openInApp = vi.fn();

    openInAppOnPlainClick(click({ metaKey: true, preventDefault }), openInApp);

    expect(openInApp).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe("linkDestinationOf", () => {
  test.each([
    ["`fragment` for a value starting with `#`", "#section", "fragment"],
    ["`site` for a path on this site", "/collection/entry", "site"],
    ["`external` for an absolute URL", "https://example.com/path", "external"],
    ["`external` for a protocol-relative URL", "//example.com/path", "external"],
    ["`external` for an absolute URL with an uppercase scheme", "HTTPS://example.com/path", "external"],
    ["`external` for a path whose second character is a backslash", String.raw`/\example.com/path`, "external"],
    ["`external` for a protocol-relative URL with a tab between its slashes", "/\t/example.com/path", "external"],
    ["`site` for a path with a query string and a fragment", "/collection/entry?page=2#section", "site"],
    ["`other` for a `mailto:` URL", "mailto:name@example.com", "other"],
    ["`other` for a `tel:` URL", "tel:+61200000000", "other"],
    ["`other` for an `ftp:` URL", "ftp://example.com/file", "other"],
    ["`other` for a relative path", "collection/entry", "other"],
    ["`other` for a relative path starting with `./`", "./entry", "other"],
    ["`other` for a query string alone", "?page=2", "other"],
  ])("returns %s", (_label, href, destination) => {
    expect(linkDestinationOf(href)).toBe(destination);
  });
});

describe("sitePathPartsOf", () => {
  test("returns the pathname, query string, and fragment of a path", () => {
    expect(sitePathPartsOf("/collection/entry?page=2#section")).toEqual({
      pathname: "/collection/entry",
      search: "?page=2",
      hash: "#section",
    });
  });

  test("returns an empty query string and fragment for a path without them", () => {
    expect(sitePathPartsOf("/collection/entry")).toEqual({ pathname: "/collection/entry", search: "", hash: "" });
  });
});
