import { describe, expect, test, vi } from "vitest";

import { collection, collectionEntries } from "#/test-utils/catalog";

import { pages } from "./catalog";
import { isDestinationOpen, resolveRoute, resolveWindow } from "./windows";

vi.mock("#/site/catalog", async () => (await import("#/test-utils/catalog")).siteCatalogMock());

const entry = collectionEntries[0]!;

describe("resolveRoute", () => {
  test("a top-level entry route resolves to an entry window backed by the pages index", () => {
    expect(resolveRoute("/page")).toMatchObject({
      id: "entry",
      title: "Page",
      slug: "page",
      collectionRoute: null,
      contentIndex: pages,
    });
  });

  test("a collection entry route resolves to an entry window backed by its collection", () => {
    expect(resolveRoute(`/collection/${entry.slug}`)).toMatchObject({
      id: "entry",
      title: entry.title,
      slug: entry.slug,
      collectionRoute: "/collection",
      contentIndex: collection,
    });
  });

  test("the contact route resolves to the contact window", () => {
    expect(resolveRoute("/contact")).toEqual({ id: "contact", title: "Contact" });
  });

  test("a path nested under contact resolves to the not-found window", () => {
    expect(resolveRoute("/contact/anything")).toMatchObject({ id: "notFound" });
  });

  test("a collection route resolves to the collection window", () => {
    expect(resolveRoute("/collection")).toMatchObject({
      id: "collection",
      title: "Collection",
      collectionRoute: "/collection",
    });
  });

  test("an unknown collection entry slug resolves to the not-found window", () => {
    expect(resolveRoute("/collection/does-not-exist")).toMatchObject({ id: "notFound" });
  });

  test("an unknown collection resolves to the not-found window", () => {
    expect(resolveRoute("/unknown-collection")).toMatchObject({ id: "notFound" });
    expect(resolveRoute("/unknown-collection/unknown-entry")).toMatchObject({ id: "notFound" });
  });

  test("the root path resolves to the desktop", () => {
    expect(resolveRoute("/")).toEqual({ id: "desktop" });
    expect(resolveRoute("")).toEqual({ id: "desktop" });
  });

  test("leading and trailing slashes are ignored", () => {
    expect(resolveRoute("/collection/")).toMatchObject({ id: "collection" });
    expect(resolveRoute("//page//")).toMatchObject({ id: "entry" });
    expect(resolveRoute(`/collection/${entry.slug}/`)).toMatchObject({ id: "entry", slug: entry.slug });
  });

  test("a route deeper than a collection entry resolves to the not-found window", () => {
    expect(resolveRoute(`/collection/${entry.slug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("resolveWindow", () => {
  test("a route resolves to the window it opens", () => {
    expect(resolveWindow("/collection")).toMatchObject({ id: "collection" });
  });

  test("a route that opens no window resolves to null", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("/no-such-page")).toBeNull();
  });
});

describe("isDestinationOpen", () => {
  test("a window open at a destination reports it open", () => {
    expect(isDestinationOpen("/page", ["/page"])).toBe(true);
    expect(isDestinationOpen("/collection", ["/collection"])).toBe(true);
    expect(isDestinationOpen("/contact", ["/contact"])).toBe(true);
  });

  test("a collection window reports its collection open however the route spells it", () => {
    expect(isDestinationOpen("/collection", ["/collection/"])).toBe(true);
  });

  test("an open collection entry leaves its parent collection closed", () => {
    expect(isDestinationOpen("/collection", [`/collection/${entry.slug}`])).toBe(false);
  });

  test("every open window is checked for the destination", () => {
    expect(isDestinationOpen("/collection", ["/page", `/collection/${entry.slug}`, "/collection"])).toBe(true);
  });

  test("a route that opens no window leaves its destination closed", () => {
    expect(isDestinationOpen("/no-such-page", ["/no-such-page"])).toBe(false);
    expect(isDestinationOpen("/collection", ["/", "/collection/does-not-exist"])).toBe(false);
  });

  test("a desktop with no open windows leaves every destination closed", () => {
    expect(isDestinationOpen("/collection", [])).toBe(false);
  });
});
