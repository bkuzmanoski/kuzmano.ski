import { afterEach, expect, test, vi } from "vitest";

import { PAGE_SLUGS } from "#/config/content.ts";
import { fakeCoverImage } from "#/test-utils/collection.ts";

import { collections, pages } from "./catalog.ts";
import { contentHead, contentRoute } from "./route-data.ts";

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
      collection: fakeCollection([...fakeCollectionEntries("published"), fakeEntry("draft-entry", { draft: true })]),
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

const DECLARED_PAGE_SLUG = PAGE_SLUGS[0];
const CONTENT_PRELOADED_FONT_FILE_NAMES = [
  "Archivo-Variable.woff2",
  "SourceSerif4-Variable.woff2",
  "QuantaStrike12-Regular.woff2",
];

const loadCollectionEntry = (slug: string) => contentRoute.loader({ params: { segment: "collection", slug } });
const loadSegment = (segment: string) => contentRoute.loader({ params: { segment } }); // A one-segment route: a page, or a collection listing.
const preloadedFontFileNamesOf = (loaderData: Awaited<ReturnType<typeof contentRoute.loader>>) =>
  contentHead(loaderData)
    .links.filter((link) => link.rel === "preload" && "as" in link)
    .map((link) => link.href.split("/").at(-1)?.split("?")[0]);

afterEach(() => {
  vi.unstubAllEnvs();
});

test("a page exposes its cover image", async () => {
  expect((await loadSegment(DECLARED_PAGE_SLUG)).coverImage).toEqual(fakeCoverImage(DECLARED_PAGE_SLUG));
});

test("a draft page does not expose a Markdown representation in production", async () => {
  vi.stubEnv("DEV", false);
  expect((await loadSegment("draft-page")).markdown).toBe(false); // A production build does not emit Markdown representations for drafts.
});

test("a page the site links to is indexable", async () => {
  expect((await loadSegment(DECLARED_PAGE_SLUG)).noindex).toBeFalsy();
});

test("a page the site does not link to is marked noindex", async () => {
  expect((await loadSegment("unlisted-page")).noindex).toBe(true);
});

test("an entry exposes its cover image, or `null` when it does not have one", async () => {
  expect((await loadCollectionEntry("published")).coverImage).toEqual(fakeCoverImage("published"));
  expect((await loadCollectionEntry("draft-entry")).coverImage).toBeNull();
});

test("a published entry exposes a Markdown representation in production", async () => {
  vi.stubEnv("DEV", false);
  expect((await loadCollectionEntry("published")).markdown).toBe(true);
});

test("a draft entry does not expose a Markdown representation in production", async () => {
  vi.stubEnv("DEV", false);
  expect((await loadCollectionEntry("draft-entry")).markdown).toBe(false); // A production build does not emit Markdown representations for drafts.
});

test("a draft entry exposes a Markdown representation in development", async () => {
  vi.stubEnv("DEV", true);
  expect((await loadCollectionEntry("draft-entry")).markdown).toBe(true); // The dev server renders the Markdown representation of a draft.
});

test("an entry the site publishes is indexable", async () => {
  expect((await loadCollectionEntry("published")).noindex).toBeFalsy();
});

test("a draft entry is marked noindex", async () => {
  expect((await loadCollectionEntry("draft-entry")).noindex).toBe(true);
});

test("a collection listing exposes a Markdown representation in production", async () => {
  vi.stubEnv("DEV", false);
  expect((await loadSegment("collection")).markdown).toBe(true);
});

test("a collection listing is indexable", async () => {
  expect((await loadSegment("collection")).noindex).toBeUndefined();
});

test.each([
  ["a page", () => loadSegment(DECLARED_PAGE_SLUG)],
  ["a collection entry", () => loadCollectionEntry("published")],
  ["a collection listing", () => loadSegment("collection")],
])("%s's head preloads the display, body, and bitmap faces", async (_kind, load) => {
  expect(preloadedFontFileNamesOf(await load())).toEqual(CONTENT_PRELOADED_FONT_FILE_NAMES);
});

test("an entry's route data does not include the URLs of the fonts its head preloads", async () => {
  expect(JSON.stringify(await loadCollectionEntry("published"))).not.toContain(".woff2");
});

test.each([
  ["a page", pages, () => loadSegment(DECLARED_PAGE_SLUG)],
  ["a collection entry", collections.collection!, () => loadCollectionEntry("published")],
])("on the server, %s's route data resolves after its body has loaded", async (_kind, contentIndex, load) => {
  const loadBodyUnmocked = contentIndex.load.bind(contentIndex);

  let isBodyLoaded = false;

  vi.stubEnv("SSR", true);
  vi.spyOn(contentIndex, "load").mockImplementation(async (slug) => {
    await new Promise((resolve) => setTimeout(resolve));
    isBodyLoaded = true;
    return loadBodyUnmocked(slug);
  });
  await load();

  expect(isBodyLoaded).toBe(true);
});

test.each([
  ["a page", pages, () => loadSegment(DECLARED_PAGE_SLUG)],
  ["a collection entry", collections.collection!, () => loadCollectionEntry("published")],
])("in the browser, %s's route data resolves without loading its body", async (_kind, contentIndex, load) => {
  const loadBody = vi.spyOn(contentIndex, "load");

  vi.stubEnv("SSR", false);
  await load();

  expect(loadBody).not.toHaveBeenCalled();
});
