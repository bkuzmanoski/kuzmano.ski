import { describe, expect, test } from "vitest";

import { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "./paths.ts";

describe("routes", () => {
  test("a page is served at its slug", () => {
    expect(pageRoute("about")).toBe("/about");
  });

  test("a collection entry is served under its collection", () => {
    expect(entryRoute("blog", "a-post")).toBe("/blog/a-post");
  });

  test("a collection is served at its segment", () => {
    expect(collectionRoute("blog")).toBe("/blog");
  });
});

describe("isRootPath", () => {
  test("a path with no segments is the root, however it is spelled", () => {
    expect(isRootPath("/")).toBe(true);
    expect(isRootPath("")).toBe(true);
    expect(isRootPath("//")).toBe(true);
  });

  test("a path with a segment is not the root", () => {
    expect(isRootPath("/about")).toBe(false);
  });
});

describe("parseContentPath", () => {
  test("a one-segment path parses into a segment with no slug", () => {
    expect(parseContentPath("/about")).toEqual({ segment: "about" });
  });

  test("a two-segment path parses into a segment and a slug", () => {
    expect(parseContentPath("/blog/a-post")).toEqual({ segment: "blog", slug: "a-post" });
  });

  test("leading, trailing and repeated slashes are ignored", () => {
    expect(parseContentPath("/about/")).toEqual({ segment: "about" });
    expect(parseContentPath("//about//")).toEqual({ segment: "about" });
    expect(parseContentPath("blog/a-post")).toEqual({ segment: "blog", slug: "a-post" });
  });

  test("the root path parses into null", () => {
    expect(parseContentPath("/")).toBeNull();
    expect(parseContentPath("")).toBeNull();
  });

  test("a path deeper than a collection entry parses into null", () => {
    expect(parseContentPath("/blog/a-post/deeper")).toBeNull();
  });
});
