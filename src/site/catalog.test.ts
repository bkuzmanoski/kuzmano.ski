import { expect, test } from "vitest";

import { COLLECTIONS, PAGE_SLUGS } from "#/config/content";
import { newestEntry, siteCollection } from "#/test-utils/content";

import { collections, pages } from "./catalog";

// Verifies site content. Catalog behavior is tested in `/src/lib/content/catalog.test.ts`.

const SEGMENTS = Object.keys(COLLECTIONS);

test.for([...PAGE_SLUGS])("the %s page is backed by a document with parseable frontmatter", (slug) => {
  expect(pages.has(slug)).toBe(true);
  expect(pages.frontmatterOf(slug)?.title).toBeTruthy();
});

test.for(SEGMENTS)("every entry in the %s collection has parseable frontmatter", (segment, ctx) => {
  const { collection, entries } = siteCollection(segment);

  if (entries.length === 0) {
    ctx.skip(`the ${segment} collection holds no entries`);
  }

  for (const entry of entries) {
    expect(collection.frontmatterOf(entry.slug)).toMatchObject({ title: entry.title, date: entry.date });
  }
});

test.for(SEGMENTS)(
  "loading the newest entry in the %s collection returns its compiled MDX module",
  async (segment, ctx) => {
    const entry = newestEntry(segment);

    if (!entry) {
      ctx.skip(`the ${segment} collection holds no entries`);
      return; // `skip` throws, but its overloaded signature does not narrow `entry` for the type checker.
    }

    const module = await collections[segment]!.load(entry.slug);

    expect(module).toHaveProperty("default");
  },
);
