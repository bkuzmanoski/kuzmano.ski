import { describe, expect, test, vi } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import type * as contentConfig from "#/config/content.ts";

import {
  authoredCollection,
  authoredContent,
  authoredContentDirectory,
  authoredEntry,
  draftEntry,
} from "../test-utils/authored-content.ts";

import { markdownFilesFor } from "./plugin.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  COLLECTIONS: { collection: { title: "Collection", description: "A description." } },
}));

describe("markdownFilesFor", () => {
  const content = authoredContent({
    pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [authoredEntry("page"), draftEntry("unfinished")]),
    collections: [authoredCollection("collection", [authoredEntry("published"), draftEntry("hidden")])],
  });

  const pathsOf = (options?: { includeDrafts?: boolean }) => markdownFilesFor(content, options).map(({ path }) => path);
  const collectionIndexMarkdown = async (tree: AuthoredContent, options?: { includeDrafts?: boolean }) => {
    const index = markdownFilesFor(tree, options).find(({ path }) => path === "/collection.md");
    return index ? index.render() : "";
  };

  test("returns a file for every page, collection entry, and collection", () => {
    expect(pathsOf()).toStrictEqual(["/page.md", "/collection/published.md", "/collection.md"]);
  });

  test("omits a draft entry, and leaves the draft out of the collection index", async () => {
    expect(pathsOf()).not.toContain("/unfinished.md");
    expect(pathsOf()).not.toContain("/collection/hidden.md");
    await expect(collectionIndexMarkdown(content)).resolves.not.toContain("hidden");
  });

  test("returns a draft entry, and lists the draft in the collection index, when `includeDrafts` is true", async () => {
    expect(pathsOf({ includeDrafts: true })).toContain("/unfinished.md");
    expect(pathsOf({ includeDrafts: true })).toContain("/collection/hidden.md");
    await expect(collectionIndexMarkdown(content, { includeDrafts: true })).resolves.toContain("hidden");
  });

  test("writes the collection index as a list linking each entry's Markdown", async () => {
    await expect(collectionIndexMarkdown(content)).resolves.toBe(
      "# Collection\n\nA description.\n\n- [published](/collection/published.md) (2026-07-19)\n  About published.\n",
    );
  });

  test("orders the collection index newest first", async () => {
    const index = await collectionIndexMarkdown({
      ...content,
      collections: [
        authoredCollection("collection", [
          authoredEntry("older", { date: "2026-01-01" }),
          authoredEntry("newer", { date: "2026-09-09" }),
        ]),
      ],
    });

    expect(index.indexOf("newer")).toBeLessThan(index.indexOf("older"));
  });

  test("escapes a title and folds a description so neither breaks its list item", async () => {
    const index = await collectionIndexMarkdown({
      ...content,
      collections: [
        authoredCollection("collection", [
          authoredEntry("brackets", {
            frontmatter: { title: "A title with [brackets]", description: "Two\nlines.", date: "2026-07-19" },
          }),
        ]),
      ],
    });
    expect(index).toContain("- [A title with \\[brackets\\]](/collection/brackets.md) (2026-07-19)\n  Two lines.\n");
  });

  test("throws when rendering a collection index containing an entry without a title", async () => {
    const index = markdownFilesFor({
      ...content,
      collections: [
        authoredCollection("collection", [
          authoredEntry("untitled", { frontmatter: { description: "A description." } }),
        ]),
      ],
    }).find(({ path }) => path === "/collection.md");
    await expect(index?.render()).rejects.toThrow("is missing a title");
  });
});
