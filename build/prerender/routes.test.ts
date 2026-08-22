import { describe, expect, test } from "vitest";

import { routesFor } from "./routes.ts";

import type { ScannedContent } from "./routes.ts";

const entry = (slug: string, date?: string) => ({ slug, draft: false, date });
const draft = (slug: string, date?: string) => ({ slug, draft: true, date });

// A valid tree that each test can modify to exercise one condition.
const content = (overrides: Partial<ScannedContent> = {}): ScannedContent => ({
  collections: [
    { name: "work", entries: [entry("work-entry", "2026-01-02")], subdirectories: [] },
    { name: "tech-notes", entries: [entry("tech-notes-entry", "2026-03-04")], subdirectories: [] },
    { name: "design-notes", entries: [], subdirectories: [] },
  ],
  pages: {
    entries: [entry("about", "2026-02-03"), entry("experience")],
    subdirectories: [],
  },
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
          { name: "work", entries: [draft("unpublished", "2026-09-09")], subdirectories: [] },
          { name: "tech-notes", entries: [], subdirectories: [] },
          { name: "design-notes", entries: [], subdirectories: [] },
        ],
        pages: {
          entries: [entry("about"), entry("experience"), draft("secret")],
          subdirectories: [],
        },
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
          { name: "Tech Notes", entries: [], subdirectories: [] },
          { name: "work", entries: [], subdirectories: [] },
          { name: "tech-notes", entries: [], subdirectories: [] },
          { name: "design-notes", entries: [], subdirectories: [] },
        ],
      }),
    ).toThrow(/not URL-safe.*Tech Notes/s);
  });

  test("fails for an entry slug that is not URL-safe", () => {
    expect(() =>
      paths({
        collections: [
          { name: "work", entries: [entry("Not A Slug")], subdirectories: [] },
          { name: "tech-notes", entries: [], subdirectories: [] },
          { name: "design-notes", entries: [], subdirectories: [] },
        ],
      }),
    ).toThrow(/not URL-safe.*Not A Slug/s);
  });

  test("fails for a page slug that is not URL-safe", () => {
    expect(() =>
      paths({
        pages: {
          entries: [entry("about"), entry("experience"), entry("Read Me")],
          subdirectories: [],
        },
      }),
    ).toThrow(/not URL-safe.*Read Me/s);
  });

  test("fails when a declared page has no corresponding file", () => {
    expect(() =>
      paths({
        pages: {
          entries: [entry("about")],
          subdirectories: [],
        },
      }),
    ).toThrow(/declared with no corresponding file.*experience/s);
  });

  test("fails when a page has the same slug as a collection", () => {
    expect(() =>
      paths({
        pages: {
          entries: [entry("about"), entry("experience"), entry("work")],
          subdirectories: [],
        },
      }),
    ).toThrow(/shadowed by a collection.*work/s);
  });

  test("fails when content shadows a reserved route", () => {
    expect(() =>
      paths({
        pages: {
          entries: [entry("about"), entry("experience"), entry("contact")],
          subdirectories: [],
        },
      }),
    ).toThrow(/shadowing reserved route/);
  });

  test("fails when a declared collection has no corresponding directory", () => {
    expect(() =>
      paths({
        collections: [
          { name: "work", entries: [], subdirectories: [] },
          { name: "tech-notes", entries: [], subdirectories: [] },
        ],
      }),
    ).toThrow(/no corresponding content directory.*design-notes/s);
  });

  test("fails when a content directory has no declared collection", () => {
    expect(() =>
      paths({
        collections: [...content().collections, { name: "unregistered", entries: [], subdirectories: [] }],
      }),
    ).toThrow(/missing titles.*unregistered/s);
  });

  test("fails for a nested directory inside a collection", () => {
    expect(() =>
      paths({
        collections: [
          { name: "work", entries: [], subdirectories: ["archive"] },
          { name: "tech-notes", entries: [], subdirectories: [] },
          { name: "design-notes", entries: [], subdirectories: [] },
        ],
      }),
    ).toThrow(/Nested content director.*archive/s);
  });

  test("fails for a nested directory inside the pages directory", () => {
    expect(() =>
      paths({
        pages: {
          entries: [entry("about"), entry("experience")],
          subdirectories: ["drafts"],
        },
      }),
    ).toThrow(/Nested content director.*drafts/s);
  });
});
