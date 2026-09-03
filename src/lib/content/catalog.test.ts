import { describe, expect, test } from "vitest";

import { CONTENT_ROOT, fakeContentSource, frontmatterOf } from "#/test-utils/content-source";
import type { FakeDocument } from "#/test-utils/content-source";

import { createCatalog } from "./catalog";

import type { TrackedPromise } from "../tracked-promise";
import type { Catalog, CatalogOptions, MDXModule } from "./catalog";

const CATALOG_OPTIONS: CatalogOptions = {
  pagesDirectory: "pages",
  collections: { collection: { title: "Collection", description: "Description." } },
  includeDrafts: false,
};
const NEWEST_DOCUMENT: FakeDocument = { frontmatter: frontmatterOf("Newest", { date: "2026-08-19" }) };
const DOCUMENTS: Record<string, FakeDocument> = {
  "pages/page.mdx": {},
  "unconfigured/entry.mdx": {},
  "collection/newest.mdx": NEWEST_DOCUMENT,
  "collection/oldest.mdx": { frontmatter: frontmatterOf("Oldest", { date: "2026-06-19" }) },
  "collection/middle.mdx": { frontmatter: frontmatterOf("Middle", { date: "2026-07-19" }) },
};

const catalogOf = (documents: Record<string, FakeDocument> = DOCUMENTS, options: Partial<CatalogOptions> = {}) =>
  createCatalog(fakeContentSource(documents), { ...CATALOG_OPTIONS, ...options });
const slugsOf = (catalog: Catalog) => catalog.collections.collection!.list().map((entry) => entry.slug);

describe("createCatalog", () => {
  test("each directory under the content root becomes an index of its own", () => {
    const { collections, pages } = catalogOf();

    expect(pages.has("page")).toBe(true);
    expect(pages.has("newest")).toBe(false);
    expect(collections.collection!.has("newest")).toBe(true);
    expect(collections.collection!.has("page")).toBe(false);
  });

  test("a directory without a configured collection is omitted from the catalog", () => {
    const { collections, pages } = catalogOf();

    expect(collections.unconfigured).toBeUndefined();
    expect(pages.has("entry")).toBe(false);
  });

  test("creating a catalog whose assets are keyed by paths outside the content glob throws", () => {
    const source = fakeContentSource(DOCUMENTS, { assets: { "/dist/collection/newest.mdx": "/assets/newest.js" } });
    expect(() => createCatalog(source, CATALOG_OPTIONS)).toThrow(/Content assets are keyed by paths/);
  });

  test("a collection takes its title and description from its configuration", () => {
    const collection = catalogOf().collections.collection!;

    expect(collection.title).toBe("Collection");
    expect(collection.description).toBe("Description.");
  });

  test("a collection's route is its directory name, and its entries are routed under it", () => {
    const collection = catalogOf().collections.collection!;

    expect(collection.route).toBe("/collection");
    expect(collection.routeOf("newest")).toBe("/collection/newest");
  });

  test("the collection listing combines each entry's frontmatter with the slug taken from its filename", () => {
    expect(catalogOf().collections.collection!.list()[0]).toEqual({
      ...frontmatterOf("Newest", { date: "2026-08-19" }),
      category: undefined,
      draft: undefined,
      slug: "newest",
    });
  });

  test("entries are listed newest first", () => {
    expect(slugsOf(catalogOf())).toEqual(["newest", "middle", "oldest"]);
  });

  test("the collection listing is built once and reused", () => {
    const collection = catalogOf().collections.collection!;
    expect(collection.list()).toBe(collection.list());
  });

  test("a draft entry is omitted from the collection listing", () => {
    const documents = {
      ...DOCUMENTS,
      "collection/draft.mdx": { frontmatter: frontmatterOf("Draft", { date: "2026-09-19", draft: true }) },
    };

    expect(slugsOf(catalogOf(documents))).toEqual(["newest", "middle", "oldest"]);
    expect(slugsOf(catalogOf(documents, { includeDrafts: true }))).toEqual(["draft", "newest", "middle", "oldest"]);
  });

  test("a draft entry is still resolved by slug when the index holds it", () => {
    const collection = catalogOf({ "collection/draft.mdx": { frontmatter: frontmatterOf("Draft", { draft: true }) } })
      .collections.collection!;

    expect(collection.has("draft")).toBe(true);
    expect(collection.frontmatterOf("draft")?.title).toBe("Draft");
  });

  test("an entry's frontmatter is looked up by slug, or null when the index does not hold it", () => {
    const collection = catalogOf().collections.collection!;

    expect(collection.frontmatterOf("newest")?.title).toBe("Newest");
    expect(collection.frontmatterOf("absent-entry")).toBeNull();
  });

  test("looking up frontmatter that does not parse throws, with the document's path in the message", () => {
    const catalog = catalogOf({ "collection/broken.mdx": { frontmatter: { description: "No title." } } });

    expect(() => catalog.collections.collection!.frontmatterOf("broken")).toThrow(
      `"${CONTENT_ROOT}/collection/broken.mdx" is missing a title.`,
    );
  });

  test("a loaded entry resolves to its compiled body", async () => {
    const module = await catalogOf().collections.collection!.load("newest");

    expect(module).toHaveProperty("default");
    expect(module.className).toBeUndefined(); // No stylesheet sits beside this entry.
  });

  test("a stylesheet beside an entry applies its page class to the entry", async () => {
    const catalog = catalogOf({ "collection/styled.mdx": { styles: { page: "styledPage" } } });
    const module = await catalog.collections.collection!.load("styled");

    expect(module.className).toBe("styledPage");
    expect(module).toHaveProperty("default");
  });

  test("loading an entry twice returns the same promise, settled after the first load", async () => {
    const collection = catalogOf().collections.collection!;

    await collection.load("newest");

    const reloaded = collection.load("newest") as TrackedPromise<MDXModule>;

    expect(reloaded).toBe(collection.load("newest"));
    expect(reloaded.status).toBe("fulfilled"); // Tracked, so a body that has loaded renders without suspending again.
  });

  test("loading an entry the index does not hold throws", () => {
    expect(() => catalogOf().collections.collection!.load("absent-entry")).toThrow(
      /Content not found: collection\/absent-entry/,
    );
  });

  test("an entry resolves to the URL of its compiled body chunk, or null when the build produced no asset for it", () => {
    const documents = { ...DOCUMENTS, "collection/newest.mdx": { ...NEWEST_DOCUMENT, asset: "/assets/newest.js" } };
    const collection = catalogOf(documents).collections.collection!;

    expect(collection.assetOf("newest")).toBe("/assets/newest.js");
    expect(collection.assetOf("middle")).toBeNull();
    expect(collection.assetOf("absent-entry")).toBeNull();
  });
});
