import { describe, expect, test } from "vitest";

import { collections, pages } from "#/content";
import { newestEntry } from "#/test-utils/content";

import { destinationRouteOf, resolveWindow } from "./window-registry";

const collection = collections["tech-notes"]!;
const entry = newestEntry("tech-notes");

describe("resolveWindow", () => {
  test("resolves a top-level entry", () => {
    expect(resolveWindow("/about")).toMatchObject({
      id: "entry",
      title: "About",
      slug: "about",
      collectionRoute: null,
      contentIndex: pages,
    });
  });

  test("resolves a collection entry", () => {
    expect(resolveWindow(`/tech-notes/${entry.slug}`)).toMatchObject({
      id: "entry",
      title: entry.title,
      slug: entry.slug,
      collectionRoute: "/tech-notes",
      contentIndex: collection,
    });
  });

  test("resolves a collection index", () => {
    expect(resolveWindow("/tech-notes")).toMatchObject({
      id: "collection",
      title: "Tech Notes",
      route: "/tech-notes",
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
    expect(resolveWindow("/tech-notes/")).toMatchObject({ id: "collection" });
    expect(resolveWindow("//about//")).toMatchObject({ id: "entry" });
    expect(resolveWindow(`/tech-notes/${entry.slug}/`)).toMatchObject({ id: "entry", slug: entry.slug });
  });

  test("a route deeper than a collection entry resolves to the 404 window", () => {
    expect(resolveWindow(`/tech-notes/${entry.slug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("destinationRouteOf", () => {
  test("returns its own route for a top-level entry or collection", () => {
    expect(destinationRouteOf("/about")).toBe("/about");
    expect(destinationRouteOf("/tech-notes")).toBe("/tech-notes");
  });

  test("returns the containing collection route for a collection entry", () => {
    expect(destinationRouteOf(`/tech-notes/${entry.slug}`)).toBe("/tech-notes");
  });

  test("returns null for routes that do not open a window", () => {
    expect(destinationRouteOf("/no-such-page")).toBeNull();
    expect(destinationRouteOf("/tech-notes/does-not-exist")).toBeNull();
    expect(destinationRouteOf("/")).toBeNull();
  });
});
