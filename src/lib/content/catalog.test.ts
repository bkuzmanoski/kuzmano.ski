import { describe, expect, test } from "vitest";

import { CONTENT_DIRECTORY_PATH, fakeContentSource, frontmatterOf } from "#/test-utils/content-source.ts";
import type { FakeDocument } from "#/test-utils/content-source.ts";

import { createCatalog } from "./catalog.ts";

import type { TrackedPromise } from "../tracked-promise.ts";
import type { Catalog, CatalogOptions, MDXModule } from "./catalog.ts";

const CATALOG_OPTIONS: CatalogOptions = {
  pagesDirectoryName: "pages",
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
const slugsOf = (catalog: Catalog) =>
  catalog.collections
    .get("collection")!
    .list()
    .map((entry) => entry.slug);

describe("createCatalog", () => {
  test("each directory under the content root becomes an index of its own", () => {
    const { collections, pages } = catalogOf();

    expect(pages.has("page")).toBe(true);
    expect(pages.has("newest")).toBe(false);
    expect(collections.get("collection")!.has("newest")).toBe(true);
    expect(collections.get("collection")!.has("page")).toBe(false);
  });

  test("the catalog omits a directory without a configured collection", () => {
    const { collections, pages } = catalogOf();

    expect(collections.get("unconfigured")).toBeUndefined();
    expect(pages.has("entry")).toBe(false);
  });

  test("a collection takes its title and description from its configuration", () => {
    const collection = catalogOf().collections.get("collection")!;

    expect(collection.title).toBe("Collection");
    expect(collection.description).toBe("Description.");
  });

  test("a collection's route is its directory name, and its entries are routed under it", () => {
    const collection = catalogOf().collections.get("collection")!;

    expect(collection.route).toBe("/collection");
    expect(collection.routeOf("newest")).toBe("/collection/newest");
  });

  test("the collection listing combines each entry's frontmatter with the slug taken from its filename", () => {
    expect(catalogOf().collections.get("collection")!.list()[0]).toEqual({
      ...frontmatterOf("Newest", { date: "2026-08-19" }),
      category: undefined,
      draft: undefined,
      slug: "newest",
    });
  });

  test("the collection listing orders entries newest first", () => {
    expect(slugsOf(catalogOf())).toEqual(["newest", "middle", "oldest"]);
  });

  test("the catalog builds the collection listing once and reuses it", () => {
    const collection = catalogOf().collections.get("collection")!;
    expect(collection.list()).toBe(collection.list());
  });

  test("the collection listing omits a draft entry", () => {
    const documents = {
      ...DOCUMENTS,
      "collection/draft.mdx": { frontmatter: frontmatterOf("Draft", { date: "2026-09-19", draft: true }) },
    };

    expect(slugsOf(catalogOf(documents))).toEqual(["newest", "middle", "oldest"]);
    expect(slugsOf(catalogOf(documents, { includeDrafts: true }))).toEqual(["draft", "newest", "middle", "oldest"]);
  });

  test("the catalog still resolves a draft entry by slug when the index contains it", () => {
    const collection = catalogOf({
      "collection/draft.mdx": { frontmatter: frontmatterOf("Draft", { draft: true }) },
    }).collections.get("collection")!;

    expect(collection.has("draft")).toBe(true);
    expect(collection.frontmatterOf("draft")?.title).toBe("Draft");
  });

  test("a collection looks up the URL of the entry icon of an entry by slug, or returns `null` for an entry without an entry icon", () => {
    const collection = catalogOf({
      ...DOCUMENTS,
      "collection/newest.mdx": { ...NEWEST_DOCUMENT, entryIconUrl: "/media/collection/newest.icon.svg" },
    }).collections.get("collection")!;

    expect(collection.entryIconUrlOf("newest")).toBe("/media/collection/newest.icon.svg");
    expect(collection.entryIconUrlOf("middle")).toBeNull();
  });

  test("the catalog looks up an entry's frontmatter by slug, or returns `null` when the index does not contain it", () => {
    const collection = catalogOf().collections.get("collection")!;

    expect(collection.frontmatterOf("newest")?.title).toBe("Newest");
    expect(collection.frontmatterOf("missing-entry")).toBeNull();
  });

  test("throws when looking up frontmatter that does not parse, with the document's path in the message", () => {
    const catalog = catalogOf({ "collection/broken.mdx": { frontmatter: { description: "No title." } } });

    expect(() => catalog.collections.get("collection")!.frontmatterOf("broken")).toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/broken.mdx" is missing a title.`,
    );
  });

  test("a loaded entry resolves to its compiled body", async () => {
    const module = await catalogOf().collections.get("collection")!.load("newest");

    expect(module).toHaveProperty("default");
    expect(module.stylesheetClassNames).toEqual({});
  });

  test("a loaded entry with a stylesheet beside it resolves with that stylesheet's `entry` class", async () => {
    const catalog = catalogOf({ "collection/styled.mdx": { styles: { entry: "styledEntry" } } });
    const module = await catalog.collections.get("collection")!.load("styled");

    expect(module.stylesheetClassNames.entry).toBe("styledEntry");
    expect(module).toHaveProperty("default");
  });

  test("a loaded entry with a stylesheet beside it resolves with that stylesheet's `title` class", async () => {
    const catalog = catalogOf({ "collection/styled.mdx": { styles: { title: "styledTitle" } } });
    const module = await catalog.collections.get("collection")!.load("styled");

    expect(module.stylesheetClassNames.title).toBe("styledTitle");
  });

  test("loading an entry twice returns the same promise, settled after the first load", async () => {
    const collection = catalogOf().collections.get("collection")!;

    await collection.load("newest");

    const reloadedModule = collection.load("newest") as TrackedPromise<MDXModule>;

    expect(reloadedModule).toBe(collection.load("newest"));
    expect(reloadedModule.status).toBe("fulfilled"); // Tracked, so a body that has loaded renders without suspending again.
  });

  test("throws when loading an entry the index does not include", () => {
    expect(() => catalogOf().collections.get("collection")!.load("missing-entry")).toThrow(
      /Content not found: collection\/missing-entry/,
    );
  });

  test("an entry resolves to the chunks and stylesheets the build produced for it, or `null` when the build did not produce a body chunk for it", () => {
    const bodyChunks = { moduleUrls: ["/assets/newest.js"], stylesheetUrls: ["/assets/newest.css"] };
    const documents = { ...DOCUMENTS, "collection/newest.mdx": { ...NEWEST_DOCUMENT, bodyChunks } };
    const collection = catalogOf(documents).collections.get("collection")!;

    expect(collection.bodyChunksOf("newest")).toEqual(bodyChunks);
    expect(collection.bodyChunksOf("middle")).toBeNull();
    expect(collection.bodyChunksOf("missing-entry")).toBeNull();
  });

  test("an entry resolves to the entry key of its directory and slug", () => {
    const { collections, pages } = catalogOf();

    expect(collections.get("collection")!.entryKeyOf("newest")).toBe("collection/newest");
    expect(pages.entryKeyOf("page")).toBe("pages/page");
  });
});
