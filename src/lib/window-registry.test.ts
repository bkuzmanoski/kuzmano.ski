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

  test("an unknown collection entry slug resolves to the 404 window", () => {
    expect(resolveWindow("/tech-notes/does-not-exist")).toMatchObject({ kind: "notFound", title: "404" });
  });

  test("an unknown collection resolves to the 404 window", () => {
    expect(resolveWindow("/unknown-collection")).toMatchObject({ kind: "notFound" });
    expect(resolveWindow("/unknown-collection/unknown-entry")).toMatchObject({ kind: "notFound" });
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

  test("a route deeper than a collection entry resolves to the 404 window", () => {
    expect(resolveWindow(`/tech-notes/${knownSlug}/invalid-route`)).toMatchObject({ kind: "notFound" });
  });
});

describe("windowKindFor", () => {
  test("a collection sizes as a collection; a page and a collection entry size as content", () => {
    expect(windowKindFor(resolveWindow("/tech-notes")!)).toBe("collection");
    expect(windowKindFor(resolveWindow("/about")!)).toBe("content");
    expect(windowKindFor(resolveWindow(`/tech-notes/${knownSlug}`)!)).toBe("content");
  });

  test("a 404 sizes as content", () => {
    expect(windowKindFor(resolveWindow("/no-such-page")!)).toBe("content");
  });
});
