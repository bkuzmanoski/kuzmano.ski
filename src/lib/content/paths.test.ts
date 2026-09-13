import { describe, expect, test } from "vitest";

import { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "./paths.ts";

describe("routes", () => {
  test("a page is routed at its slug", () => {
    expect(pageRoute("page")).toBe("/page");
  });

  test("a collection entry is routed under its collection", () => {
    expect(entryRoute("collection", "entry")).toBe("/collection/entry");
  });

  test("a collection is routed at its segment", () => {
    expect(collectionRoute("collection")).toBe("/collection");
  });
});

describe("isRootPath", () => {
  test("a path without segments is the root, however it is spelled", () => {
    expect(isRootPath("/")).toBe(true);
    expect(isRootPath("")).toBe(true);
    expect(isRootPath("//")).toBe(true);
  });

  test("a path with a segment is not the root", () => {
    expect(isRootPath("/page")).toBe(false);
  });
});

describe("parseContentPath", () => {
  test("a one-segment path resolves to a segment without a slug", () => {
    expect(parseContentPath("/page")).toEqual({ segment: "page" });
  });

  test("a two-segment path resolves to a segment and a slug", () => {
    expect(parseContentPath("/collection/entry")).toEqual({ segment: "collection", slug: "entry" });
  });

  test("leading, trailing, and repeated slashes are ignored", () => {
    expect(parseContentPath("/page/")).toEqual({ segment: "page" });
    expect(parseContentPath("//page//")).toEqual({ segment: "page" });
    expect(parseContentPath("collection/entry")).toEqual({ segment: "collection", slug: "entry" });
  });

  test("the root path resolves to `null`", () => {
    expect(parseContentPath("/")).toBeNull();
    expect(parseContentPath("")).toBeNull();
  });

  test("a path deeper than a collection entry resolves to `null`", () => {
    expect(parseContentPath("/collection/entry/deeper")).toBeNull();
  });
});
