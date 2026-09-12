import { describe, expect, test, vi } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import type * as contentConfig from "#/config/content.ts";
import { MEDIA_SEGMENT } from "#/lib/content/paths.ts";

import { CONTENT_DIRECTORY_PATH } from "../paths.ts";
import {
  authoredCollection,
  authoredContent,
  authoredContentDirectory,
  authoredEntry,
  draftEntry,
} from "../test-utils/authored-content.ts";

import { routesFor } from "./routes.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  COLLECTIONS: {
    "collection-1": { title: "Collection 1", description: "" },
    "collection-2": { title: "Collection 2", description: "" },
    "collection-3": { title: "Collection 3", description: "" },
  },
  PAGE_SLUGS: ["page-1", "page-2"],
}));

const undatedEntry = { date: undefined };

// A valid tree that each test can modify to exercise one condition.
const content = (overrides: Partial<AuthoredContent> = {}): AuthoredContent =>
  authoredContent({
    pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
      authoredEntry("page-1", { date: "2026-02-03" }),
      authoredEntry("page-2", undatedEntry),
    ]),
    collections: [
      authoredCollection("collection-1", [authoredEntry("entry-1", { date: "2026-01-02" })]),
      authoredCollection("collection-2", [authoredEntry("entry-2", { date: "2026-03-04" })]),
      authoredCollection("collection-3"),
    ],
    ...overrides,
  });

const routes = (overrides?: Partial<AuthoredContent>) => routesFor(content(overrides));
const paths = (overrides?: Partial<AuthoredContent>) => routes(overrides).map(({ path }) => path);

describe("routes", () => {
  test("includes the home pages, collections, collection entries, and contact routes in order", () => {
    expect(paths()).toEqual([
      "/",
      "/page-1",
      "/page-2",
      "/collection-1",
      "/collection-1/entry-1",
      "/collection-2",
      "/collection-2/entry-2",
      "/collection-3",
      "/contact",
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

  test("omits the sitemap metadata for an entry with no date", () => {
    expect(routes()).toContainEqual({ path: "/page-2" });
  });

  test("omits draft entries", () => {
    const pathsWithDrafts = routesFor(
      content({
        pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
          authoredEntry("page-1", undatedEntry),
          authoredEntry("page-2", undatedEntry),
          draftEntry("secret", undatedEntry),
        ]),
        collections: [
          authoredCollection("collection-1", [draftEntry("unpublished", { date: "2026-09-09" })]),
          authoredCollection("collection-2"),
          authoredCollection("collection-3"),
        ],
      }),
    ).map(({ path }) => path);

    expect(pathsWithDrafts).not.toContain("/collection-1/unpublished");
    expect(pathsWithDrafts).not.toContain("/secret");
    expect(pathsWithDrafts).toContain("/collection-1");
  });

  test("prerenders a page the site does not link to, but omits it from the sitemap", () => {
    const routesWithUnregisteredPage = routes({
      pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
        authoredEntry("page-1", { date: "2026-02-03" }),
        authoredEntry("page-2", undatedEntry),
        authoredEntry("unlisted", { date: "2026-01-01" }),
      ]),
    });

    expect(routesWithUnregisteredPage).toContainEqual({ path: "/unlisted", sitemap: { exclude: true } });
    expect(routesWithUnregisteredPage).toContainEqual({ path: "/page-1", sitemap: { lastmod: "2026-02-03" } });
  });

  test("includes an entry with an adjacent media directory", () => {
    expect(
      paths({
        collections: [
          authoredCollection("collection-1", [authoredEntry("entry-1", undatedEntry)], ["entry-1"]),
          authoredCollection("collection-2"),
          authoredCollection("collection-3"),
        ],
      }),
    ).toContain("/collection-1/entry-1");
  });
});

describe("invalid content", () => {
  test("fails for a collection name that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          authoredCollection("Collection Four"),
          authoredCollection("collection-1"),
          authoredCollection("collection-2"),
          authoredCollection("collection-3"),
        ],
      }),
    ).toThrow(/URL-unsafe.*Collection Four/s);
  });

  test("fails for an entry slug that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          authoredCollection("collection-1", [authoredEntry("Not A Slug", undatedEntry)]),
          authoredCollection("collection-2"),
          authoredCollection("collection-3"),
        ],
      }),
    ).toThrow(/URL-unsafe.*Not A Slug/s);
  });

  test("fails for a page slug that is not URL-safe", () => {
    expect(() =>
      paths({
        pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
          authoredEntry("page-1", undatedEntry),
          authoredEntry("page-2", undatedEntry),
          authoredEntry("Read Me", undatedEntry),
        ]),
      }),
    ).toThrow(/URL-unsafe.*Read Me/s);
  });

  test("fails when a declared page has no corresponding file", () => {
    expect(() =>
      paths({ pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [authoredEntry("page-1", undatedEntry)]) }),
    ).toThrow(/declared with no corresponding content file.*page-2/s);
  });

  test("fails when a page has the same slug as a collection", () => {
    expect(() =>
      paths({
        pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
          authoredEntry("page-1", undatedEntry),
          authoredEntry("page-2", undatedEntry),
          authoredEntry("collection-1", undatedEntry),
        ]),
      }),
    ).toThrow(/shadowed by a collection.*collection-1/s);
  });

  test("fails when content shadows a reserved route", () => {
    expect(() =>
      paths({
        pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
          authoredEntry("page-1", undatedEntry),
          authoredEntry("page-2", undatedEntry),
          authoredEntry("contact", undatedEntry),
        ]),
      }),
    ).toThrow(/shadowing reserved route/);
  });

  test("fails when a declared collection has no corresponding directory", () => {
    expect(() =>
      paths({ collections: [authoredCollection("collection-1"), authoredCollection("collection-2")] }),
    ).toThrow(/no corresponding content directory.*collection-3/s);
  });

  test("fails when a content directory has no declared collection", () => {
    expect(() => paths({ collections: [...content().collections, authoredCollection("unregistered")] })).toThrow(
      /no declared collection.*unregistered/s,
    );
  });

  test("fails for a directory inside a collection without an entry of the same name", () => {
    expect(() =>
      paths({
        collections: [
          authoredCollection("collection-1", [authoredEntry("entry-1", undatedEntry)], ["archive"]),
          authoredCollection("collection-2"),
          authoredCollection("collection-3"),
        ],
      }),
    ).toThrow(/no matching entry.*archive/s);
  });

  test("fails for a directory inside the pages directory without an entry of the same name", () => {
    expect(() =>
      paths({
        pages: authoredContentDirectory(
          PAGES_DIRECTORY_NAME,
          [authoredEntry("page-1", undatedEntry), authoredEntry("page-2", undatedEntry)],
          ["drafts"],
        ),
      }),
    ).toThrow(/no matching entry.*drafts/s);
  });

  test("fails for a page whose name shadows the media segment", () => {
    const pathsWithMediaPage = () =>
      paths({
        pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [
          ...content().pages.entries,
          authoredEntry(MEDIA_SEGMENT, undatedEntry),
        ]),
      });

    expect(pathsWithMediaPage).toThrow("reserved route");
    expect(pathsWithMediaPage).toThrow(`${CONTENT_DIRECTORY_PATH}/${PAGES_DIRECTORY_NAME}/${MEDIA_SEGMENT}.mdx`);
  });

  test("fails for a collection directory whose name shadows the media segment", () => {
    const pathsWithMediaCollection = () =>
      paths({ collections: [...content().collections, authoredCollection(MEDIA_SEGMENT)] });

    expect(pathsWithMediaCollection).toThrow("reserved route");
    expect(pathsWithMediaCollection).toThrow(`${CONTENT_DIRECTORY_PATH}/${MEDIA_SEGMENT}/`);
  });
});
