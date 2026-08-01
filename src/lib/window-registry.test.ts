import { describe, expect, test } from "vitest";

import { collections } from "#/content";

import { resolveWindow, windowKindFor } from "./window-registry";

const knownSlug = collections["tech-notes"]?.list()[0]?.slug;

describe("resolveWindow", () => {
  test("resolves a top-level page", () => {
    expect(resolveWindow("/about")).toMatchObject({ kind: "page", slug: "about", title: "About" });
  });

  test("resolves a collection index", () => {
    expect(resolveWindow("/tech-notes")).toMatchObject({ kind: "collection", slug: "tech-notes", title: "Tech Notes" });
  });

  test("an unknown collection entry slug is not a window", () => {
    expect(resolveWindow("/tech-notes/does-not-exist")).toBeNull();
  });

  test("an unknown collection is not a window", () => {
    expect(resolveWindow("/unknown-collection")).toBeNull();
    expect(resolveWindow("/unknown-collection/unknown-entry")).toBeNull();
  });

  test("the bare desktop is not a window", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("")).toBeNull();
  });

  test("ignores leading and trailing slashes", () => {
    expect(resolveWindow("/tech-notes/")).toMatchObject({ kind: "collection" });
    expect(resolveWindow("//about//")).toMatchObject({ kind: "page" });
    expect(resolveWindow(`/tech-notes/${knownSlug}/`)).toMatchObject({ kind: "collectionEntry" });
  });

  test("a route deeper than a collection entry is not a window", () => {
    expect(resolveWindow(`/tech-notes/${knownSlug}/invalid-route`)).toBeNull();
  });
});

describe("windowKindFor", () => {
  test("a collection sizes as a collection; a page and a collection entry size as content", () => {
    expect(windowKindFor(resolveWindow("/tech-notes")!)).toBe("collection");
    expect(windowKindFor(resolveWindow("/about")!)).toBe("content");
    expect(windowKindFor(resolveWindow(`/tech-notes/${knownSlug}`)!)).toBe("content");
  });
});
