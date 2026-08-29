import { describe, expect, test } from "vitest";

import { markdownOf } from "./markdown.ts";

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
});
