import { describe, expect, test } from "vitest";

import {
  draftEntry,
  scannedCollection,
  scannedContent,
  scannedDirectory,
  scannedEntry,
} from "#/test-utils/scanned-content.ts";

import { routesFor } from "./routes.ts";

import type { ScannedContent } from "./routes.ts";

const undated = { date: undefined };

// A valid tree that each test can modify to exercise one condition.
const content = (overrides: Partial<ScannedContent> = {}): ScannedContent =>
  scannedContent({
    collections: [
      scannedCollection("work", [scannedEntry("work-entry", { date: "2026-01-02" })]),
      scannedCollection("tech-notes", [scannedEntry("tech-notes-entry", { date: "2026-03-04" })]),
      scannedCollection("design-notes"),
    ],
    pages: scannedDirectory([scannedEntry("about", { date: "2026-02-03" }), scannedEntry("experience", undated)]),
    ...overrides,
  });

const routes = (overrides?: Partial<ScannedContent>) => routesFor(content(overrides));
const paths = (overrides?: Partial<ScannedContent>) => routes(overrides).map(({ path }) => path);

describe("routes", () => {
  test("includes the home page, contact page, collections, and entries", () => {
    expect(paths()).toEqual([
      "/",
      "/contact",
      "/work",
      "/work/work-entry",
      "/tech-notes",
      "/tech-notes/tech-notes-entry",
      "/design-notes",
      "/about",
      "/experience",
    ]);
  });

  test("uses an entry's date as its sitemap lastmod", () => {
    expect(routes()).toContainEqual({
      path: "/work/work-entry",
      sitemap: { lastmod: "2026-01-02" },
    });
  });

  test("uses the newest entry date as a collection's sitemap lastmod", () => {
    expect(routes()).toContainEqual({
      path: "/work",
      sitemap: { lastmod: "2026-01-02" },
    });
  });

  test("uses the newest date anywhere for the home page and empty collections", () => {
    expect(routes()).toContainEqual({
      path: "/",
      sitemap: { lastmod: "2026-03-04" },
    });
    expect(routes()).toContainEqual({
      path: "/design-notes",
      sitemap: { lastmod: "2026-03-04" },
    });
  });

  test("omits lastmod when an entry has no date", () => {
    expect(routes()).toContainEqual({ path: "/experience" });
  });

  test("omits draft entries", () => {
    const withDrafts = routesFor(
      content({
        collections: [
          scannedCollection("work", [draftEntry("unpublished", { date: "2026-09-09" })]),
          scannedCollection("tech-notes"),
          scannedCollection("design-notes"),
        ],
        pages: scannedDirectory([
          scannedEntry("about", undated),
          scannedEntry("experience", undated),
          draftEntry("secret", undated),
        ]),
      }),
    ).map(({ path }) => path);

    expect(withDrafts).not.toContain("/work/unpublished");
    expect(withDrafts).not.toContain("/secret");
    expect(withDrafts).toContain("/work");
  });
});

describe("invalid content", () => {
  test("fails for a collection name that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          scannedCollection("Tech Notes"),
          scannedCollection("work"),
          scannedCollection("tech-notes"),
          scannedCollection("design-notes"),
        ],
      }),
    ).toThrow(/not URL-safe.*Tech Notes/s);
  });

  test("fails for an entry slug that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          scannedCollection("work", [scannedEntry("Not A Slug", undated)]),
          scannedCollection("tech-notes"),
          scannedCollection("design-notes"),
        ],
      }),
    ).toThrow(/not URL-safe.*Not A Slug/s);
  });

  test("fails for a page slug that is not URL-safe", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("about", undated),
          scannedEntry("experience", undated),
          scannedEntry("Read Me", undated),
        ]),
      }),
    ).toThrow(/not URL-safe.*Read Me/s);
  });

  test("fails when a declared page has no corresponding file", () => {
    expect(() => paths({ pages: scannedDirectory([scannedEntry("about", undated)]) })).toThrow(
      /declared with no corresponding file.*experience/s,
    );
  });

  test("fails when a page has the same slug as a collection", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("about", undated),
          scannedEntry("experience", undated),
          scannedEntry("work", undated),
        ]),
      }),
    ).toThrow(/shadowed by a collection.*work/s);
  });

  test("fails when content shadows a reserved route", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([
          scannedEntry("about", undated),
          scannedEntry("experience", undated),
          scannedEntry("contact", undated),
        ]),
      }),
    ).toThrow(/shadowing reserved route/);
  });

  test("fails when a declared collection has no corresponding directory", () => {
    expect(() => paths({ collections: [scannedCollection("work"), scannedCollection("tech-notes")] })).toThrow(
      /no corresponding content directory.*design-notes/s,
    );
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
          scannedCollection("work", [], ["archive"]),
          scannedCollection("tech-notes"),
          scannedCollection("design-notes"),
        ],
      }),
    ).toThrow(/Nested content director.*archive/s);
  });

  test("fails for a nested directory inside the pages directory", () => {
    expect(() =>
      paths({
        pages: scannedDirectory([scannedEntry("about", undated), scannedEntry("experience", undated)], ["drafts"]),
      }),
    ).toThrow(/Nested content director.*drafts/s);
  });
});
