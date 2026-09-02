import { describe, expect, test } from "vitest";

import { pages } from "#/site/catalog";
import { testCollection } from "#/test-utils/content";

import { isDestinationOpen, resolveRoute, resolveWindow } from "./window-registry";

const { collection, entries } = testCollection("blog");
const entry = entries[0]!;

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
    expect(resolveRoute(`/blog/${entry.slug}`)).toMatchObject({
      id: "entry",
      title: entry.title,
      slug: entry.slug,
      collectionRoute: "/blog",
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
    expect(resolveRoute("/blog")).toMatchObject({
      id: "collection",
      title: "Blog",
      collectionRoute: "/blog",
    });
  });

  test("an unknown collection entry slug resolves to the not-found window", () => {
    expect(resolveRoute("/blog/does-not-exist")).toMatchObject({ id: "notFound" });
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
    expect(resolveRoute("/blog/")).toMatchObject({ id: "collection" });
    expect(resolveRoute("//about//")).toMatchObject({ id: "entry" });
    expect(resolveRoute(`/blog/${entry.slug}/`)).toMatchObject({ id: "entry", slug: entry.slug });
  });

  test("a route deeper than a collection entry resolves to the not-found window", () => {
    expect(resolveRoute(`/blog/${entry.slug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("resolveWindow", () => {
  test("returns the window a route opens", () => {
    expect(resolveWindow("/blog")).toMatchObject({ id: "collection" });
  });

  test("returns null for the routes that do not open a window", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("/no-such-page")).toBeNull();
  });
});

describe("isDestinationOpen", () => {
  test("a window open at a destination reports it open", () => {
    expect(isDestinationOpen("/about", ["/about"])).toBe(true);
    expect(isDestinationOpen("/blog", ["/blog"])).toBe(true);
    expect(isDestinationOpen("/contact", ["/contact"])).toBe(true);
  });

  test("a collection window reports its collection open however the route spells it", () => {
    expect(isDestinationOpen("/blog", ["/blog/"])).toBe(true);
  });

  test("an open collection entry leaves its parent collection closed", () => {
    expect(isDestinationOpen("/blog", [`/blog/${entry.slug}`])).toBe(false);
  });

  test("checks every open window", () => {
    expect(isDestinationOpen("/blog", ["/about", `/blog/${entry.slug}`, "/blog"])).toBe(true);
  });

  test("a route that opens no window leaves its destination closed", () => {
    expect(isDestinationOpen("/no-such-page", ["/no-such-page"])).toBe(false);
    expect(isDestinationOpen("/blog", ["/", "/blog/does-not-exist"])).toBe(false);
  });

  test("a desktop with no open windows leaves every destination closed", () => {
    expect(isDestinationOpen("/blog", [])).toBe(false);
  });
});
