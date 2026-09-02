import { describe, expect, test } from "vitest";

import { createCatalog } from "./catalog";

import type { CatalogOptions, ContentSource } from "./catalog";

const ROOT = "/content";
const ENTRY_PATH = `${ROOT}/blog/entry.mdx`;
const ENTRY_CHUNK = "/assets/entry-D3adB33f.js";

const OPTIONS: CatalogOptions = {
  collections: { blog: { title: "Blog", description: "" } },
  pagesDirectory: "_pages",
  includeDrafts: false,
};

function contentSource(assets: Record<string, string | undefined> = {}): ContentSource {
  return {
    root: ROOT,
    frontmatter: { [ENTRY_PATH]: { default: { title: "Entry", description: "Description.", date: "2026-07-19" } } },
    content: { [ENTRY_PATH]: () => Promise.resolve({ default: () => null }) },
    styles: {},
    assets,
  };
}

const blogIn = (source: ContentSource) => createCatalog(source, OPTIONS).collections.blog!;

describe("assetOf", () => {
  test("returns the compiled content chunk URL", () => {
    expect(blogIn(contentSource({ [ENTRY_PATH]: ENTRY_CHUNK })).assetOf("entry")).toBe(ENTRY_CHUNK);
  });

  test("returns null when no compiled content chunk exists", () => {
    expect(blogIn(contentSource()).assetOf("entry")).toBeNull();
  });

  test("throws for asset paths outside the content glob", () => {
    expect(() => createCatalog(contentSource({ "./blog/entry.mdx": ENTRY_CHUNK }), OPTIONS)).toThrow(
      /not included in the content glob/,
    );
  });
});
