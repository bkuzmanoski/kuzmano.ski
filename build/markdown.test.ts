import { describe, expect, test } from "vitest";

import {
  draftEntry,
  scannedCollection,
  scannedContent,
  scannedDirectory,
  scannedEntry,
} from "#/test-utils/scanned-content.ts";

import { markdownFilesFor, markdownOf } from "./markdown.ts";

import type { ScannedContent } from "./prerender/routes.ts";

const FRONTMATTER = `---
title: An Entry
description: A description.
date: 2026-07-19
---
`;

describe("markdownOf", () => {
  test("keeps the frontmatter block", async () => {
    await expect(markdownOf(`${FRONTMATTER}\nBody.\n`)).resolves.toContain(FRONTMATTER.trim());
  });

  test("keeps prose, headings, and code fences", async () => {
    const markdown = await markdownOf(`${FRONTMATTER}\n# Heading\n\nSome _text_.\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n`);

    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("Some _text_.");
    expect(markdown).toContain("```ts\nconst a = 1;\n```");
  });

  test("drops imports, exports, and expressions", async () => {
    const markdown = await markdownOf(
      `${FRONTMATTER}\nimport { Note } from "./note";\nexport const value = 1;\n\n{/* A comment */}\n\nBody.\n`,
    );

    expect(markdown).not.toContain("import");
    expect(markdown).not.toContain("export");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a component with its children", async () => {
    const markdown = await markdownOf(
      `${FRONTMATTER}\n<Note>\n  A wrapped paragraph.\n</Note>\n\nA <Emphasis>wrapped phrase</Emphasis>.\n`,
    );

    expect(markdown).not.toContain("<Note>");
    expect(markdown).not.toContain("<Emphasis>");
    expect(markdown).toContain("A wrapped paragraph.");
    expect(markdown).toContain("A wrapped phrase.");
  });

  test("drops a component that has no children", async () => {
    await expect(markdownOf(`${FRONTMATTER}\n<Figure src="/a.png" />\n\nBody.\n`)).resolves.not.toContain("Figure");
  });

  test("replaces a component nested inside another", async () => {
    const markdown = await markdownOf(
      `${FRONTMATTER}\n<Note>\n  <Callout>\n    A nested paragraph.\n  </Callout>\n</Note>\n`,
    );

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("A nested paragraph.");
  });

  test("replaces a component nested inside a phrase", async () => {
    const markdown = await markdownOf(
      `${FRONTMATTER}\nA <Emphasis>phrase <Strong>within</Strong> a phrase</Emphasis>.\n`,
    );
    expect(markdown).toContain("A phrase within a phrase.");
  });

  test("omits an expression and a childless component nested inside a component", async () => {
    const markdown = await markdownOf(
      `${FRONTMATTER}\n<Note>\n  <Figure src="/image.png" />\n\n  {/* A comment */}\n\n  Body.\n</Note>\n`,
    );

    expect(markdown).not.toContain("Figure");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });
});

describe("markdownFilesFor", () => {
  const content = scannedContent({
    collections: [scannedCollection("work", [scannedEntry("published"), draftEntry("hidden")])],
    pages: scannedDirectory([scannedEntry("about"), draftEntry("unfinished")]),
  });

  const pathsOf = (options?: { drafts?: boolean }) => markdownFilesFor(content, options).map(({ path }) => path);
  const indexOf = async (tree: ScannedContent, options?: { drafts?: boolean }) => {
    const index = markdownFilesFor(tree, options).find(({ path }) => path === "/work.md");
    return index ? index.render() : "";
  };

  test("serves a file for every standalone page, collection, and entry", () => {
    expect(pathsOf()).toStrictEqual(["/about.md", "/work.md", "/work/published.md"]);
  });

  test("omits drafts unless they are included", async () => {
    expect(pathsOf()).not.toContain("/unfinished.md");
    expect(pathsOf()).not.toContain("/work/hidden.md");
    expect(pathsOf({ drafts: true })).toContain("/unfinished.md");
    expect(pathsOf({ drafts: true })).toContain("/work/hidden.md");
    await expect(indexOf(content)).resolves.not.toContain("hidden");
    await expect(indexOf(content, { drafts: true })).resolves.toContain("hidden");
  });

  test("writes the collection index as a list linking each entry's markdown", async () => {
    await expect(indexOf(content)).resolves.toBe(
      "# Work\n\nSelected projects.\n\n- [published](/work/published.md) (2026-07-19)\n  About published.\n",
    );
  });

  test("orders the collection index newest first", async () => {
    const index = await indexOf({
      ...content,
      collections: [
        scannedCollection("work", [
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
        scannedCollection("work", [
          scannedEntry("brackets", {
            frontmatter: { title: "Notes on [X]", description: "Two\nlines.", date: "2026-07-19" },
          }),
        ]),
      ],
    });
    expect(index).toContain("- [Notes on \\[X\\]](/work/brackets.md) (2026-07-19)\n  Two lines.\n");
  });

  test("rejects an entry whose frontmatter is incomplete", async () => {
    const index = markdownFilesFor({
      ...content,
      collections: [
        scannedCollection("work", [scannedEntry("untitled", { frontmatter: { description: "A description." } })]),
      ],
    }).find(({ path }) => path === "/work.md");
    await expect(index?.render()).rejects.toThrow("is missing a title");
  });
});
