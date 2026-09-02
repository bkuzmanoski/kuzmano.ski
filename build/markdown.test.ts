import { describe, expect, test, vi } from "vitest";

import type * as contentConfig from "#/config/content.ts";
import { fallbackText } from "#/lib/waitlist/render-fallback.ts";

import { markdownFilesFor, markdownFor } from "./markdown.ts";
import {
  draftEntry,
  scannedCollection,
  scannedContent,
  scannedDirectory,
  scannedEntry,
} from "./test-utils/scanned-content.ts";

import type { ScannedContent } from "./prerender/routes.ts";

vi.mock("#/config/content.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof contentConfig>()),
  COLLECTIONS: { collection: { title: "Collection", description: "A description." } },
}));

const ENTRY_URL = "https://example.com/collection/entry";
const FRONTMATTER = `---
title: An Entry
description: A description.
date: 2026-07-19
---
`;

describe("markdownFor", () => {
  test("keeps the frontmatter block", async () => {
    await expect(markdownFor(`${FRONTMATTER}\nBody.\n`)).resolves.toContain(FRONTMATTER.trim());
  });

  test("keeps prose, headings, and code fences", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n# Heading\n\nSome _text_.\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n`);

    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("Some _text_.");
    expect(markdown).toContain("```ts\nconst a = 1;\n```");
  });

  test("omits imports, exports, and expressions", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\nimport { Note } from "./note";\nexport const value = 1;\n\n{/* A comment */}\n\nBody.\n`,
    );

    expect(markdown).not.toContain("import");
    expect(markdown).not.toContain("export");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a component with its children", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Note>\n  A wrapped paragraph.\n</Note>\n\nA <Emphasis>wrapped phrase</Emphasis>.\n`,
    );

    expect(markdown).not.toContain("<Note>");
    expect(markdown).not.toContain("<Emphasis>");
    expect(markdown).toContain("A wrapped paragraph.");
    expect(markdown).toContain("A wrapped phrase.");
  });

  test("omits a component that has no children", async () => {
    await expect(markdownFor(`${FRONTMATTER}\n<Figure src="/a.png" />\n\nBody.\n`)).resolves.not.toContain("Figure");
  });

  test("replaces a component nested inside another", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Note>\n  <Callout>\n    A nested paragraph.\n  </Callout>\n</Note>\n`,
    );

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("A nested paragraph.");
  });

  test("replaces a component nested inside a phrase", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\nA <Emphasis>phrase <Strong>within</Strong> a phrase</Emphasis>.\n`,
    );
    expect(markdown).toContain("A phrase within a phrase.");
  });

  test("omits an expression and a childless component nested inside a component", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Note>\n  <Figure src="/image.png" />\n\n  {/* A comment */}\n\n  Body.\n</Note>\n`,
    );

    expect(markdown).not.toContain("Figure");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a waitlist component with fallback Markdown", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Waitlist list="List">\n  Description.\n</Waitlist>\n\nBody.\n`,
      {
        url: ENTRY_URL,
      },
    );

    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(ENTRY_URL));
    expect(markdown).toContain("Body.");
  });

  test("rejects a component whose fallback Markdown is a block written inside a sentence", async () => {
    await expect(
      markdownFor(`${FRONTMATTER}\nA sentence with <Waitlist list="List">a phrase</Waitlist> inside it.\n`, {
        path: "entry.mdx",
        url: ENTRY_URL,
      }),
    ).rejects.toThrow(/entry\.mdx.*Waitlist/);
  });

  test("omits a waitlist component when there is no entry URL to link back to", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n<Waitlist list="List">\n  Description.\n</Waitlist>\n`);

    expect(markdown).not.toContain("waitlist");
    expect(markdown).not.toContain("Description.");
  });
});

describe("markdownFilesFor", () => {
  const content = scannedContent({
    collections: [scannedCollection("collection", [scannedEntry("published"), draftEntry("hidden")])],
    pages: scannedDirectory([scannedEntry("page"), draftEntry("unfinished")]),
  });

  const pathsOf = (options?: { drafts?: boolean }) => markdownFilesFor(content, options).map(({ path }) => path);
  const indexOf = async (tree: ScannedContent, options?: { drafts?: boolean }) => {
    const index = markdownFilesFor(tree, options).find(({ path }) => path === "/collection.md");
    return index ? index.render() : "";
  };

  test("serves a file for every standalone page, collection, and entry", () => {
    expect(pathsOf()).toStrictEqual(["/page.md", "/collection.md", "/collection/published.md"]);
  });

  test("omits drafts unless they are included", async () => {
    expect(pathsOf()).not.toContain("/unfinished.md");
    expect(pathsOf()).not.toContain("/collection/hidden.md");
    expect(pathsOf({ drafts: true })).toContain("/unfinished.md");
    expect(pathsOf({ drafts: true })).toContain("/collection/hidden.md");
    await expect(indexOf(content)).resolves.not.toContain("hidden");
    await expect(indexOf(content, { drafts: true })).resolves.toContain("hidden");
  });

  test("writes the collection index as a list linking each entry's markdown", async () => {
    await expect(indexOf(content)).resolves.toBe(
      "# Collection\n\nA description.\n\n- [published](/collection/published.md) (2026-07-19)\n  About published.\n",
    );
  });

  test("orders the collection index newest first", async () => {
    const index = await indexOf({
      ...content,
      collections: [
        scannedCollection("collection", [
          scannedEntry("older", { date: "2026-01-01" }),
          scannedEntry("newer", { date: "2026-09-09" }),
        ]),
      ],
    });

    expect(index.indexOf("newer")).toBeLessThan(index.indexOf("older"));
  });

  test("escapes a title and folds a description so neither breaks its list item", async () => {
    const index = await indexOf({
      ...content,
      collections: [
        scannedCollection("collection", [
          scannedEntry("brackets", {
            frontmatter: { title: "Notes on [X]", description: "Two\nlines.", date: "2026-07-19" },
          }),
        ]),
      ],
    });
    expect(index).toContain("- [Notes on \\[X\\]](/collection/brackets.md) (2026-07-19)\n  Two lines.\n");
  });

  test("rejects an entry whose frontmatter is incomplete", async () => {
    const index = markdownFilesFor({
      ...content,
      collections: [
        scannedCollection("collection", [scannedEntry("untitled", { frontmatter: { description: "A description." } })]),
      ],
    }).find(({ path }) => path === "/collection.md");
    await expect(index?.render()).rejects.toThrow("is missing a title");
  });
});
