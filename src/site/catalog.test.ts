import { expect, test } from "vitest";

import { COLLECTIONS, PAGE_SLUGS } from "#/config/content";
import { newestEntry, siteCollection } from "#/test-utils/content";

import { collections, pages } from "./catalog";

// Verifies site content. Catalog behavior is tested in `/src/lib/content/catalog.test.ts`.

const SEGMENTS = Object.keys(COLLECTIONS);

test.each([...PAGE_SLUGS])("the %s page is backed by a document with parseable frontmatter", (slug) => {
  expect(pages.has(slug)).toBe(true);
  expect(pages.frontmatterOf(slug)?.title).toBeTruthy();
});

test.each(SEGMENTS)("every entry in the %s collection has parseable frontmatter", (segment) => {
  const { collection, entries } = siteCollection(segment);

  for (const entry of entries) {
    expect(collection.frontmatterOf(entry.slug)).toMatchObject({ title: entry.title, date: entry.date });
  }
});

test.each(SEGMENTS)(
  "loading the newest entry in the %s collection returns its compiled MDX module",
  async (segment) => {
    const module = await collections[segment]!.load(newestEntry(segment).slug);
    expect(module).toHaveProperty("default");
  },
);
