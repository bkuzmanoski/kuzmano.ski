import { describe, expect, test } from "vitest";

import { collections, pages } from "#/content";
import { newestEntry } from "#/test-utils/content";

import { destinationRouteOf, resolveRoute, resolveWindow } from "./window-registry";

const collection = collections["tech-notes"]!;
const entry = newestEntry("tech-notes");

describe("resolveRoute", () => {
  test("resolves a top-level entry", () => {
    expect(resolveRoute("/about")).toMatchObject({
      id: "entry",
      title: "About",
      slug: "about",
      collectionRoute: null,
      contentIndex: pages,
    });
  });

  test("resolves a collection entry", () => {
    expect(resolveRoute(`/tech-notes/${entry.slug}`)).toMatchObject({
      id: "entry",
      title: entry.title,
      slug: entry.slug,
      collectionRoute: "/tech-notes",
      contentIndex: collection,
    });
  });

  test("resolves the contact window", () => {
    expect(resolveRoute("/contact")).toEqual({ id: "contact", title: "Contact" });
  });

  test("does not resolve paths nested under contact", () => {
    expect(resolveRoute("/contact/anything")).toMatchObject({ id: "notFound" });
  });

  test("resolves a collection index", () => {
    expect(resolveRoute("/tech-notes")).toMatchObject({
      id: "collection",
      title: "Tech Notes",
      route: "/tech-notes",
    });
  });

  test("an unknown collection entry slug resolves to the not-found window", () => {
    expect(resolveRoute("/tech-notes/does-not-exist")).toMatchObject({ id: "notFound" });
  });

  test("an unknown collection resolves to the not-found window", () => {
    expect(resolveRoute("/unknown-collection")).toMatchObject({ id: "notFound" });
    expect(resolveRoute("/unknown-collection/unknown-entry")).toMatchObject({ id: "notFound" });
  });

  test("resolves the root path to the desktop", () => {
    expect(resolveRoute("/")).toEqual({ id: "desktop" });
    expect(resolveRoute("")).toEqual({ id: "desktop" });
  });

  test("ignores leading and trailing slashes", () => {
    expect(resolveRoute("/tech-notes/")).toMatchObject({ id: "collection" });
    expect(resolveRoute("//about//")).toMatchObject({ id: "entry" });
    expect(resolveRoute(`/tech-notes/${entry.slug}/`)).toMatchObject({ id: "entry", slug: entry.slug });
  });

  test("a route deeper than a collection entry resolves to the not-found window", () => {
    expect(resolveRoute(`/tech-notes/${entry.slug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("resolveWindow", () => {
  test("returns the window a route opens", () => {
    expect(resolveWindow("/tech-notes")).toMatchObject({ id: "collection" });
  });

  test("returns null for the routes that do not open a window", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("/no-such-page")).toBeNull();
  });
});

describe("destinationRouteOf", () => {
  test("returns the route for a top-level page or collection", () => {
    expect(destinationRouteOf("/about")).toBe("/about");
    expect(destinationRouteOf("/tech-notes")).toBe("/tech-notes");
  });

  test("returns the route for a collection entry", () => {
    expect(destinationRouteOf(`/tech-notes/${entry.slug}`)).toBe("/tech-notes");
  });

  test("returns the route for the contact window", () => {
    expect(destinationRouteOf("/contact")).toBe("/contact");
  });

  test("returns null for routes without a window", () => {
    expect(destinationRouteOf("/no-such-page")).toBeNull();
    expect(destinationRouteOf("/tech-notes/does-not-exist")).toBeNull();
    expect(destinationRouteOf("/")).toBeNull();
  });
});
