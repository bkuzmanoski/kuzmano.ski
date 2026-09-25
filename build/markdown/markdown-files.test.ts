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
import { linkTextsIn } from "../test-utils/markdown.ts";

import { markdownFilesFor, renderedMarkdownFilesFor } from "./markdown-files.ts";

import type { AuthoredContent } from "../content/authored-content.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  COLLECTIONS: {
    collection: { title: "Collection", description: "A description." },
    undescribed: { title: "Undescribed", description: "" },
  },
}));

const MARKDOWN_SYNTAX_TITLE = "A *title* with _emphasis_, `code`, <html>, and [brackets]";

const collectionIndexMarkdown = async (tree: AuthoredContent, options?: { includeDrafts?: boolean }) => {
  const index = markdownFilesFor(tree, options).find(({ path }) => path === "/collection.md");
  return index ? index.render() : "";
};

describe("markdownFilesFor", () => {
  const content = authoredContent({
    pages: authoredContentDirectory(PAGES_DIRECTORY_NAME, [authoredEntry("page"), draftEntry("unfinished")]),
    collections: [authoredCollection("collection", [authoredEntry("published"), draftEntry("hidden")])],
  });

  const pathsOf = (options?: { includeDrafts?: boolean }) => markdownFilesFor(content, options).map(({ path }) => path);

  test("returns a file for every page, collection entry, and collection", () => {
    expect(pathsOf()).toStrictEqual(["/page.md", "/collection/published.md", "/collection.md"]);
  });

  test("omits a draft entry, and does not list the draft in the collection index", async () => {
    expect(pathsOf()).not.toContain("/unfinished.md");
    expect(pathsOf()).not.toContain("/collection/hidden.md");
    await expect(collectionIndexMarkdown(content)).resolves.not.toContain("hidden");
  });

  test("returns a draft entry, and lists the draft in the collection index, when `includeDrafts` is `true`", async () => {
    expect(pathsOf({ includeDrafts: true })).toContain("/unfinished.md");
    expect(pathsOf({ includeDrafts: true })).toContain("/collection/hidden.md");
    await expect(collectionIndexMarkdown(content, { includeDrafts: true })).resolves.toContain("hidden");
  });

  test("renders the collection index as a list linking each entry's Markdown", async () => {
    await expect(collectionIndexMarkdown(content)).resolves.toBe(
      "# Collection\n\nA description.\n\n- [published](/collection/published.md) (2026-07-19)\n  About published.\n",
    );
  });

  test("omits the description from the collection index when the collection's description is empty", async () => {
    const index = markdownFilesFor(
      authoredContent({ collections: [authoredCollection("undescribed", [authoredEntry("entry")])] }),
    ).find(({ path }) => path === "/undescribed.md");
    await expect(index?.render()).resolves.toBe(
      "# Undescribed\n\n- [entry](/undescribed/entry.md) (2026-07-19)\n  About entry.\n",
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

  test("writes a title containing Markdown syntax as the literal text of its link", async () => {
    const index = await collectionIndexMarkdown({
      ...content,
      collections: [
        authoredCollection("collection", [
          authoredEntry("entry", {
            frontmatter: { title: MARKDOWN_SYNTAX_TITLE, description: "A description.", date: "2026-07-19" },
          }),
        ]),
      ],
    });
    expect(linkTextsIn(index)).toStrictEqual([MARKDOWN_SYNTAX_TITLE]);
  });

  test("collapses a description written over several lines onto the line below its link", async () => {
    const index = await collectionIndexMarkdown({
      ...content,
      collections: [
        authoredCollection("collection", [
          authoredEntry("entry", {
            frontmatter: {
              title: "A title",
              description: `The first line
                and the second line.`,
              date: "2026-07-19",
            },
          }),
        ]),
      ],
    });
    expect(index).toContain(`- [A title](/collection/entry.md) (2026-07-19)
  The first line and the second line.
`);
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

describe("renderedMarkdownFilesFor", () => {
  test("returns each file's rendered Markdown, keyed by the path it is served from", async () => {
    const contentWithEmptyCollection = authoredContent({ collections: [authoredCollection("collection")] });
    const files = await renderedMarkdownFilesFor(contentWithEmptyCollection);

    expect(files).toStrictEqual(
      new Map([["/collection.md", await collectionIndexMarkdown(contentWithEmptyCollection)]]),
    );
  });
});
