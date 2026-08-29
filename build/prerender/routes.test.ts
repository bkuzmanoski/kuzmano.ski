import { describe, expect, test, vi } from "vitest";

import type * as contentConfig from "#/config/content.ts";

import {
  draftEntry,
  scannedCollection,
  scannedContent,
  scannedDirectory,
  scannedEntry,
} from "../test-utils/scanned-content.ts";

import { routesFor } from "./routes.ts";

import type { ScannedContent } from "./routes.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  COLLECTIONS: {
    "collection-1": { title: "Collection 1", description: "" },
    "collection-2": { title: "Collection 2", description: "" },
    "collection-3": { title: "Collection 3", description: "" },
  },
  PAGE_SLUGS: ["page-1", "page-2"],
}));

const undated = { date: undefined };

// A valid tree that each test can modify to exercise one condition.
const content = (overrides: Partial<ScannedContent> = {}): ScannedContent =>
  scannedContent({
    collections: [
      scannedCollection("collection-1", [scannedEntry("entry-1", { date: "2026-01-02" })]),
      scannedCollection("collection-2", [scannedEntry("entry-2", { date: "2026-03-04" })]),
      scannedCollection("collection-3"),
    ],
    pages: scannedDirectory([scannedEntry("page-1", { date: "2026-02-03" }), scannedEntry("page-2", undated)]),
    ...overrides,
  });

const routes = (overrides?: Partial<ScannedContent>) => routesFor(content(overrides));
const paths = (overrides?: Partial<ScannedContent>) => routes(overrides).map(({ path }) => path);

describe("routes", () => {
  test("includes the home page, contact page, collections, and entries", () => {
    expect(paths()).toEqual([
      "/",
      "/contact",
      "/collection-1",
      "/collection-1/entry-1",
      "/collection-2",
      "/collection-2/entry-2",
      "/collection-3",
      "/page-1",
      "/page-2",
    ]);
  });

  test("uses an entry's date as its sitemap lastmod", () => {
    expect(routes()).toContainEqual({
      path: "/collection-1/entry-1",
      sitemap: { lastmod: "2026-01-02" },
    });
  });

  test("uses the newest entry date as a collection's sitemap lastmod", () => {
    expect(routes()).toContainEqual({
      path: "/collection-1",
      sitemap: { lastmod: "2026-01-02" },
    });
  });

  test("uses the newest date anywhere for the home page and empty collections", () => {
    expect(routes()).toContainEqual({
      path: "/",
      sitemap: { lastmod: "2026-03-04" },
    });
    expect(routes()).toContainEqual({
      path: "/collection-3",
      sitemap: { lastmod: "2026-03-04" },
    });
  });

  test("omits lastmod when an entry has no date", () => {
    expect(routes()).toContainEqual({ path: "/page-2" });
  });

  test("omits draft entries", () => {
    const withDrafts = routesFor(
      content({
        collections: [
          scannedCollection("collection-1", [draftEntry("unpublished", { date: "2026-09-09" })]),
          scannedCollection("collection-2"),
          scannedCollection("collection-3"),
        ],
        pages: scannedDirectory([
          scannedEntry("page-1", undated),
          scannedEntry("page-2", undated),
          draftEntry("secret", undated),
        ]),
      }),
    ).map(({ path }) => path);

    expect(withDrafts).not.toContain("/collection-1/unpublished");
    expect(withDrafts).not.toContain("/secret");
    expect(withDrafts).toContain("/collection-1");
  });
});

describe("invalid content", () => {
  test("fails for a collection name that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          scannedCollection("Collection Four"),
          scannedCollection("collection-1"),
          scannedCollection("collection-2"),
          scannedCollection("collection-3"),
        ],
      }),
    ).toThrow(/not URL-safe.*Collection Four/s);
  });

  test("fails for an entry slug that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          scannedCollection("collection-1", [scannedEntry("Not A Slug", undated)]),
          scannedCollection("collection-2"),
          scannedCollection("collection-3"),
        ],
      }),
    ).toThrow(/not URL-safe.*Not A Slug/s);
  });

  test("fails for a page slug that is not URL-safe", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("page-1", undated),
          scannedEntry("page-2", undated),
          scannedEntry("Read Me", undated),
        ]),
      }),
    ).toThrow(/not URL-safe.*Read Me/s);
  });

  test("fails when a declared page has no corresponding file", () => {
    expect(() => paths({ pages: scannedDirectory([scannedEntry("page-1", undated)]) })).toThrow(
      /declared with no corresponding file.*page-2/s,
    );
  });

  test("fails when a page has the same slug as a collection", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("page-1", undated),
          scannedEntry("page-2", undated),
          scannedEntry("collection-1", undated),
        ]),
      }),
    ).toThrow(/shadowed by a collection.*collection-1/s);
  });

  test("fails when content shadows a reserved route", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("page-1", undated),
          scannedEntry("page-2", undated),
          scannedEntry("contact", undated),
        ]),
      }),
    ).toThrow(/shadowing reserved route/);
  });

  test("fails when a declared collection has no corresponding directory", () => {
    expect(() =>
      paths({ collections: [scannedCollection("collection-1"), scannedCollection("collection-2")] }),
    ).toThrow(/no corresponding content directory.*collection-3/s);
  });

  test("fails when a content directory has no declared collection", () => {
    expect(() => paths({ collections: [...content().collections, scannedCollection("unregistered")] })).toThrow(
      /missing titles.*unregistered/s,
    );
  });

  test("fails for a nested directory inside a collection", () => {
    expect(() =>
      paths({
        collections: [
          scannedCollection("collection-1", [], ["archive"]),
          scannedCollection("collection-2"),
          scannedCollection("collection-3"),
        ],
      }),
    ).toThrow(/Nested content director.*archive/s);
  });

  test("fails for a nested directory inside the pages directory", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([scannedEntry("page-1", undated), scannedEntry("page-2", undated)], ["drafts"]),
      }),
    ).toThrow(/Nested content director.*drafts/s);
  });
});
