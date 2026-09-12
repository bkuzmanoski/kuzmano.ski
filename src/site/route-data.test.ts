import { afterEach, expect, test, vi } from "vitest";

import { PAGE_SLUGS } from "#/config/content.ts";
import { fakeCoverImage } from "#/test-utils/collection.ts";

import { contentRoute } from "./route-data.ts";

vi.mock("./catalog.ts", async () => {
  const { PAGES_DIRECTORY_NAME: pagesDirectoryName, PAGE_SLUGS: slugs } = await import("#/config/content.ts");
  const { fakeCollection, fakeCollectionEntries, fakeContentIndex, fakeEntry } =
    await import("#/test-utils/collection.ts");
  const { siteCatalogMock } = await import("#/test-utils/catalog.ts");

  return siteCatalogMock({
    pages: fakeContentIndex(
      [fakeEntry(slugs[0]), fakeEntry("unlisted-page"), fakeEntry("draft-page", { draft: true })],
      pagesDirectoryName,
    ),
    collections: {
      collection: fakeCollection([...fakeCollectionEntries("published"), fakeEntry("draft", { draft: true })]),
    },
  });
});

vi.mock("virtual:entry-cover-images", async () => {
  const { PAGES_DIRECTORY_NAME: pagesDirectoryName, PAGE_SLUGS: slugs } = await import("#/config/content.ts");
  const collectionFakes = await import("#/test-utils/collection.ts");

  return {
    ENTRY_COVER_IMAGES: {
      [`${pagesDirectoryName}/${slugs[0]}`]: collectionFakes.fakeCoverImage(slugs[0]),
      "collection/published": collectionFakes.fakeCoverImage("published"),
    },
  };
});

const REGISTERED_PAGE = PAGE_SLUGS[0];

const loadCollectionEntry = (slug: string) => contentRoute.loader({ params: { segment: "collection", slug } });
const loadSegment = (segment: string) => contentRoute.loader({ params: { segment } }); // A one-segment route: a page, or a collection listing.

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a page the site links to is not marked noindex", () => {
  expect(loadSegment(REGISTERED_PAGE).noindex).toBeFalsy();
});

test("a page the site does not link to is marked noindex", () => {
  expect(loadSegment("unlisted-page").noindex).toBe(true);
});

test("an entry the site publishes is not marked noindex", () => {
  expect(loadCollectionEntry("published").noindex).toBeFalsy();
});

test("a draft entry is marked noindex", () => {
  expect(loadCollectionEntry("draft").noindex).toBe(true);
});

test("a collection listing is not marked noindex", () => {
  expect(loadSegment("collection").noindex).toBeUndefined();
});

test("a published entry exposes the Markdown alternate the build emits for it", () => {
  vi.stubEnv("DEV", false);
  expect(loadCollectionEntry("published").markdown).toBe(true);
});

test("a draft entry does not expose a Markdown alternate, which is not emitted in a production build", () => {
  vi.stubEnv("DEV", false);

  expect(loadCollectionEntry("draft").markdown).toBe(false);
  expect(loadSegment("draft-page").markdown).toBe(false);
});

test("a draft exposes its Markdown alternate in development, where the server renders one", () => {
  vi.stubEnv("DEV", true);
  expect(loadCollectionEntry("draft").markdown).toBe(true);
});

test("a collection listing exposes its Markdown alternate", () => {
  vi.stubEnv("DEV", false);
  expect(loadSegment("collection").markdown).toBe(true);
});

test("a page exposes its cover image", () => {
  expect(loadSegment(REGISTERED_PAGE).coverImage).toEqual(fakeCoverImage(REGISTERED_PAGE));
});

test("an entry exposes its cover image, or null when it does not have one", () => {
  expect(loadCollectionEntry("published").coverImage).toEqual(fakeCoverImage("published"));
  expect(loadCollectionEntry("draft").coverImage).toBeNull();
});
