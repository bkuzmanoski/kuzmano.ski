import { describe, expect, test, vi } from "vitest";

import { collection, collectionEntries, configuredCollections } from "#/test-utils/catalog.ts";

import { pages } from "./catalog.ts";
import { collectionFeedOf } from "./feeds.ts";
import {
  contentIndexOf,
  isDestinationOpen,
  resolveRoute,
  resolveWindow,
  windowAlternateRepresentationsOf,
} from "./windows.ts";

vi.mock("./catalog.ts", async () => {
  const { configuredCollections: collectionsWithFeeds, siteCatalogMock } = await import("#/test-utils/catalog.ts");
  return siteCatalogMock({ collections: { ...siteCatalogMock().collections, ...collectionsWithFeeds } });
});

const COLLECTION_WITH_FEED = Object.values(configuredCollections)[0]!;
const COLLECTION_WITH_FEED_ENTRY_ROUTE = COLLECTION_WITH_FEED.routeOf(COLLECTION_WITH_FEED.list()[0]!.slug);
const COLLECTION_ENTRY = collectionEntries[0]!;

describe("contentIndexOf", () => {
  test("returns the pages index for a page, and the collection for a collection entry", () => {
    const page = resolveWindow("/page");
    const entry = resolveWindow(`/collection/${COLLECTION_ENTRY.slug}`);

    expect(page?.id === "entry" && contentIndexOf(page)).toBe(pages);
    expect(entry?.id === "entry" && contentIndexOf(entry)).toBe(collection);
  });
});

describe("resolveRoute", () => {
  test("a top-level entry route resolves to an entry window without a collection", () => {
    expect(resolveRoute("/page")).toMatchObject({
      id: "entry",
      title: "Page",
      slug: "page",
      collection: null,
    });
  });

  test("a collection entry route resolves to an entry window with its collection", () => {
    expect(resolveRoute(`/collection/${COLLECTION_ENTRY.slug}`)).toMatchObject({
      id: "entry",
      title: COLLECTION_ENTRY.title,
      slug: COLLECTION_ENTRY.slug,
      collection,
    });
  });

  test("a collection route resolves to the collection window", () => {
    expect(resolveRoute("/collection")).toMatchObject({
      id: "collection",
      title: "Collection",
      collection,
    });
  });

  test("the contact route resolves to the contact window", () => {
    expect(resolveRoute("/contact")).toEqual({ id: "contact", title: "Contact" });
  });

  test("the control panel route resolves to the control panel window", () => {
    expect(resolveRoute("/control-panel")).toEqual({ id: "controlPanel", title: "Control Panel" });
  });

  test("a path nested under contact resolves to the not-found window", () => {
    expect(resolveRoute("/contact/anything")).toMatchObject({ id: "notFound" });
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
    expect(resolveRoute(`/collection/${COLLECTION_ENTRY.slug}/`)).toMatchObject({
      id: "entry",
      slug: COLLECTION_ENTRY.slug,
    });
  });

  test("a route deeper than a collection entry resolves to the not-found window", () => {
    expect(resolveRoute(`/collection/${COLLECTION_ENTRY.slug}/invalid-route`)).toMatchObject({ id: "notFound" });
  });
});

describe("resolveWindow", () => {
  test("a route resolves to the window it opens", () => {
    expect(resolveWindow("/collection")).toMatchObject({ id: "collection" });
  });

  test("a route that does not open a window resolves to `null`", () => {
    expect(resolveWindow("/")).toBeNull();
    expect(resolveWindow("/nonexistent-page")).toBeNull();
  });
});

describe("isDestinationOpen", () => {
  test("a destination is open when a window is open at its route", () => {
    expect(isDestinationOpen("/page", ["/page"])).toBe(true);
    expect(isDestinationOpen("/collection", ["/collection"])).toBe(true);
    expect(isDestinationOpen("/contact", ["/contact"])).toBe(true);
  });

  test("a collection destination is open when its window's route has a trailing slash", () => {
    expect(isDestinationOpen("/collection", ["/collection/"])).toBe(true);
  });

  test("a collection destination is closed when only one of its entries is open", () => {
    expect(isDestinationOpen("/collection", [`/collection/${COLLECTION_ENTRY.slug}`])).toBe(false);
  });

  test("a destination is open when any of several open windows is at its route", () => {
    expect(isDestinationOpen("/collection", ["/page", `/collection/${COLLECTION_ENTRY.slug}`, "/collection"])).toBe(
      true,
    );
  });

  test("a destination is closed when an open route does not open a window", () => {
    expect(isDestinationOpen("/nonexistent-page", ["/nonexistent-page"])).toBe(false);
    expect(isDestinationOpen("/collection", ["/", "/collection/does-not-exist"])).toBe(false);
  });

  test("a destination is closed when there are no open windows", () => {
    expect(isDestinationOpen("/collection", [])).toBe(false);
  });
});

describe("windowAlternateRepresentationsOf", () => {
  test("returns the alternate representations of the page a window shows", () => {
    expect(windowAlternateRepresentationsOf("/page")).toEqual({ markdownRepresentationPath: "/page.md", feed: null });
  });

  test("returns the alternate representations of the collection entry a window shows", () => {
    expect(windowAlternateRepresentationsOf(COLLECTION_WITH_FEED_ENTRY_ROUTE)).toEqual({
      markdownRepresentationPath: `${COLLECTION_WITH_FEED_ENTRY_ROUTE}.md`,
      feed: collectionFeedOf(COLLECTION_WITH_FEED.route),
    });
  });

  test("returns the alternate representations of the collection a window shows, including when the window's route has a trailing slash", () => {
    const expected = {
      markdownRepresentationPath: `${COLLECTION_WITH_FEED.route}.md`,
      feed: collectionFeedOf(COLLECTION_WITH_FEED.route),
    };

    expect(windowAlternateRepresentationsOf(COLLECTION_WITH_FEED.route)).toEqual(expected);
    expect(windowAlternateRepresentationsOf(`${COLLECTION_WITH_FEED.route}/`)).toEqual(expected);
  });

  test("returns `null` for a feature route's window", () => {
    expect(windowAlternateRepresentationsOf("/contact")).toBeNull();
  });
});
