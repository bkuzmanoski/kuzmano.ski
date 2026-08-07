import { describe, expect, test } from "vitest";

import { collections } from "#/content";

import { desktopRouteOf, resolveWindow, windowRouteFor } from "./window-registry";

const entries = collections["tech-notes"]!.list();
const knownSlug = entries[0]?.slug;

describe("resolveWindow", () => {
  test("resolves a top-level page", () => {
    expect(resolveWindow("/about")).toMatchObject({ id: "page", slug: "about", title: "About" });
  });

  test("resolves a collection index", () => {
    expect(resolveWindow("/tech-notes")).toMatchObject({
      id: "collection",
      basePath: "/tech-notes",
      entrySlug: null,
      title: "Tech Notes",
    });
  });

  test("a collection entry resolves to the collection window, on that entry", () => {
    expect(resolveWindow(`/tech-notes/${knownSlug}`)).toMatchObject({
      id: "collection",
      basePath: "/tech-notes",
      entrySlug: knownSlug,
      title: entries[0]!.title,
    });
  });

  test("an unknown collection entry slug resolves to the 404 window", () => {
    expect(resolveWindow("/tech-notes/does-not-exist")).toMatchObject({ id: "notFound" });
  });

  test("an unknown collection resolves to the 404 window", () => {
    expect(resolveWindow("/unknown-collection")).toMatchObject({ id: "notFound" });
    expect(resolveWindow("/unknown-collection/unknown-entry")).toMatchObject({ id: "notFound" });
  });

  test("the bare desktop is not a window", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("")).toBeNull();
  });

  test("ignores leading and trailing slashes", () => {
    expect(resolveWindow("/tech-notes/")).toMatchObject({ id: "collection", entrySlug: null });
    expect(resolveWindow("//about//")).toMatchObject({ id: "page" });
    expect(resolveWindow(`/tech-notes/${knownSlug}/`)).toMatchObject({ id: "collection", entrySlug: knownSlug });
  });

  test("a route deeper than a collection entry resolves to the 404 window", () => {
    expect(resolveWindow(`/tech-notes/${knownSlug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("windowRouteFor", () => {
  test("a collection index opens on its most recent entry", () => {
    expect(windowRouteFor("/tech-notes")).toBe(`/tech-notes/${knownSlug}`);
  });

  test("every other route opens itself", () => {
    expect(windowRouteFor("/about")).toBe("/about");
    expect(windowRouteFor(`/tech-notes/${knownSlug}`)).toBe(`/tech-notes/${knownSlug}`);
    expect(windowRouteFor("/no-such-page")).toBe("/no-such-page");
  });
});

describe("desktopRouteOf", () => {
  test("a collection entry traces back to its collection", () => {
    expect(desktopRouteOf(`/tech-notes/${knownSlug}`)).toBe("/tech-notes");
    expect(desktopRouteOf("/tech-notes")).toBe("/tech-notes");
  });

  test("every other route traces back to itself", () => {
    expect(desktopRouteOf("/about")).toBe("/about");
    expect(desktopRouteOf("/no-such-page")).toBe("/no-such-page");
  });
});
