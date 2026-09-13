import { describe, expect, test } from "vitest";

import { mediaRoute } from "#/lib/content/paths.ts";
import { fallbackText } from "#/lib/waitlist/render-fallback.ts";

import { CONTENT_DIRECTORY_PATH, fromContent } from "../paths.ts";
import { ENTRY_ABSOLUTE_PATH, MEDIA_FILE_HASH } from "../test-utils/media.ts";

import { markdownFor } from "./markdown.ts";

import type { MediaForEntry } from "../content/markup/media-rewrite.ts";

const ENTRY_URL = "https://example.com/collection/entry";
const FRONTMATTER = `---
title: A title
description: A description.
date: 2026-07-19
---
`;
const IMAGE = {
  kind: "image" as const,
  src: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.png`),
  width: 900,
  height: 500,
  alternates: [{ srcSet: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.avif`), type: "image/avif" }],
};
const VIDEO = {
  kind: "video" as const,
  src: mediaRoute(`collection/entry/video.${MEDIA_FILE_HASH}.mp4`),
  width: 960,
  height: 540,
  posterImage: {
    src: mediaRoute(`collection/entry/video.poster.${MEDIA_FILE_HASH}.webp`),
    width: 960,
    height: 540,
  },
};

const MEDIA: Record<string, typeof IMAGE | typeof VIDEO> = { "./image.png": IMAGE, "./video.mp4": VIDEO };

const mediaForEntry: MediaForEntry = (absolutePath) =>
  Promise.resolve((reference: string) => (absolutePath === ENTRY_ABSOLUTE_PATH ? (MEDIA[reference] ?? null) : null));

describe("markdownFor", () => {
  test("preserves the frontmatter block", async () => {
    await expect(markdownFor(`${FRONTMATTER}\nBody.\n`)).resolves.toContain(FRONTMATTER.trim());
  });

  test("preserves prose, headings, and code fences", async () => {
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

  test("replaces a component with fallback Markdown nested inside a component replaced by its children", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Note>\n  <Waitlist list="List">\n    Description.\n  </Waitlist>\n</Note>\n`,
      { url: ENTRY_URL },
    );

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(ENTRY_URL));
  });

  test("replaces a component nested inside another written inside a sentence", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\nA <Emphasis>phrase <Strong>within</Strong> a phrase</Emphasis>.\n`,
    );
    expect(markdown).toContain("A phrase within a phrase.");
  });

  test("omits an expression and a component without children nested inside another", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<Note>\n  <Figure src="/image.png" />\n\n  {/* A comment */}\n\n  Body.\n</Note>\n`,
    );

    expect(markdown).not.toContain("Figure");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a `Waitlist` with its children and its fallback Markdown", async () => {
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

  test("throws when a component whose fallback Markdown is a block is written inside a sentence, naming the file by its repository-relative path and the component", async () => {
    const pendingMarkdown = markdownFor(
      `${FRONTMATTER}\nA sentence with <Waitlist list="List">a phrase</Waitlist> inside it.\n`,
      { path: fromContent("collection/entry.mdx"), url: ENTRY_URL },
    );

    await expect(pendingMarkdown).rejects.toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx" writes components inline`,
    );
    await expect(pendingMarkdown).rejects.toThrow("Waitlist");
  });

  test("omits a `Waitlist` when no entry URL is given", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n<Waitlist list="List">\n  Description.\n</Waitlist>\n`);

    expect(markdown).not.toContain("waitlist");
    expect(markdown).not.toContain("Description.");
  });

  test("resolves a Markdown image to the absolute URL of the file the site serves", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n![An image](./image.png)\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain(`![An image](https://kuzmano.ski${IMAGE.src})`);
  });

  test("resolves a reference-style Markdown image in its definition to the absolute URL of the file the site serves", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n![An image][d]\n\n[d]: ./image.png\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });

    expect(markdown).toContain("![An image][d]");
    expect(markdown).toContain(`[d]: https://kuzmano.ski${IMAGE.src}`);
  });

  test("preserves the destination of a reference definition used only by a link", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n[The notes][n]\n\n[n]: ./notes.md\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain("[n]: ./notes.md");
  });

  test("renders an `<img>` as a Markdown image with the absolute URL of the file the site serves", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<picture>\n  <source srcSet="./image.png" type="image/avif" />\n  <img src="./image.png" alt="An image" />\n</picture>\n`,
      { path: ENTRY_ABSOLUTE_PATH, mediaForEntry },
    );
    expect(markdown).toContain(`![An image](https://kuzmano.ski${IMAGE.src})`);
  });

  test("preserves the blank lines around an `<img>` written as a block", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\nBefore.\n\n<img src="./image.png" alt="An image" />\n\nAfter.\n`,
      { path: ENTRY_ABSOLUTE_PATH, mediaForEntry },
    );
    expect(markdown).toContain(`Before.\n\n![An image](https://kuzmano.ski${IMAGE.src})\n\nAfter.`);
  });

  test("preserves an image reference to a file the site does not serve", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n![An image](./nonexistent-image.png)\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain("![An image](./nonexistent-image.png)");
  });

  test("preserves a Markdown image reference to a video", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n![A video](./video.mp4)\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain("![A video](./video.mp4)");
  });

  test("preserves the URL of an external image", async () => {
    await expect(
      markdownFor(`${FRONTMATTER}\n![An image](https://example.com/image.png)\n`, {
        path: ENTRY_ABSOLUTE_PATH,
        mediaForEntry,
      }),
    ).resolves.toContain("![An image](https://example.com/image.png)");
  });

  test("renders a `video` as a link to the file, with its poster image as the link content", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n<video src="./video.mp4" controls />\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain(`[![](https://kuzmano.ski${VIDEO.posterImage.src})](https://kuzmano.ski${VIDEO.src})`);
  });

  test("renders a `video` with its label as the alternative text of its poster image", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}\n<video src="./video.mp4" aria-label="A video" />\n`, {
      path: ENTRY_ABSOLUTE_PATH,
      mediaForEntry,
    });
    expect(markdown).toContain(`![A video](https://kuzmano.ski${VIDEO.posterImage.src})`);
  });

  test("renders a `video` with a `source` child the same as one with a `src` attribute", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\n<video controls>\n  <source src="./video.mp4" type="video/mp4" />\n</video>\n`,
      { path: ENTRY_ABSOLUTE_PATH, mediaForEntry },
    );
    expect(markdown).toContain(`[![](https://kuzmano.ski${VIDEO.posterImage.src})](https://kuzmano.ski${VIDEO.src})`);
  });
});
