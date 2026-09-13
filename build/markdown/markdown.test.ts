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
    const markdown = await markdownFor(`${FRONTMATTER}
      Body.
    `);
    expect(markdown).toContain(FRONTMATTER.trim());
  });

  test("preserves prose, headings, and code fences", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      # Heading

      Some _text_.

      \`\`\`ts
      const a = 1;
      \`\`\`
    `);

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
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        A wrapped paragraph.
      </Note>

      A <Emphasis>wrapped phrase</Emphasis>.
    `);

    expect(markdown).not.toContain("<Note>");
    expect(markdown).not.toContain("<Emphasis>");
    expect(markdown).toContain("A wrapped paragraph.");
    expect(markdown).toContain("A wrapped phrase.");
  });

  test("omits a component without children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Figure src="/a.png" />

      Body.
    `);
    expect(markdown).not.toContain("Figure");
  });

  test("replaces a component nested inside another with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        <Callout>
          A nested paragraph.
        </Callout>
      </Note>
    `);

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("A nested paragraph.");
  });

  test("replaces a component with fallback Markdown, nested inside one without, with its children and its fallback Markdown", async () => {
    const source = `${FRONTMATTER}
      <Note>
        <Waitlist list="List">
          Description.
        </Waitlist>
      </Note>
    `;
    const markdown = await markdownFor(source, { url: ENTRY_URL });

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(ENTRY_URL));
  });

  test("replaces a component nested inside another, written inside a sentence, with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      A <Emphasis>phrase <Strong>within</Strong> a phrase</Emphasis>.
    `);
    expect(markdown).toContain("A phrase within a phrase.");
  });

  test("omits an expression and a component without children nested inside another", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        <Figure src="/image.png" />

        {/* A comment */}

        Body.
      </Note>
    `);

    expect(markdown).not.toContain("Figure");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a `Waitlist` with its children and its fallback Markdown", async () => {
    const source = `${FRONTMATTER}
      <Waitlist list="List">
        Description.
      </Waitlist>

      Body.
    `;
    const markdown = await markdownFor(source, { url: ENTRY_URL });

    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(ENTRY_URL));
    expect(markdown).toContain("Body.");
  });

  test("throws when a component whose fallback Markdown is a block is written inside a sentence, naming the file by its repository-relative path and the component", async () => {
    const source = `${FRONTMATTER}
      A sentence with <Waitlist list="List">a phrase</Waitlist> inside it.
    `;
    const pendingMarkdown = markdownFor(source, { path: fromContent("collection/entry.mdx"), url: ENTRY_URL });

    await expect(pendingMarkdown).rejects.toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx" writes components inline`,
    );
    await expect(pendingMarkdown).rejects.toThrow("Waitlist");
  });

  test("omits a `Waitlist` when called without an entry URL", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Waitlist list="List">
        Description.
      </Waitlist>
    `);

    expect(markdown).not.toContain("waitlist");
    expect(markdown).not.toContain("Description.");
  });

  test("resolves a Markdown image to the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image](./image.png)
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`![An image](https://kuzmano.ski${IMAGE.src})`);
  });

  test("resolves an image reference's definition to the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image][definition]

      [definition]: ./image.png
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });

    expect(markdown).toContain("![An image][definition]");
    expect(markdown).toContain(`[definition]: https://kuzmano.ski${IMAGE.src}`);
  });

  test("preserves the destination of a definition used only by a link", async () => {
    const source = `${FRONTMATTER}
      [The notes][n]

      [n]: ./notes.md
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain("[n]: ./notes.md");
  });

  test("renders the `<img>` of a `<picture>` as a Markdown image with the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      <picture>
        <source srcSet="./image.png" type="image/avif" />
        <img src="./image.png" alt="An image" />
      </picture>
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`![An image](https://kuzmano.ski${IMAGE.src})`);
  });

  test("preserves the blank lines around an `<img>` written as a block", async () => {
    const source = `${FRONTMATTER}
      Before.

      <img src="./image.png" alt="An image" />

      After.
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`Before.\n\n![An image](https://kuzmano.ski${IMAGE.src})\n\nAfter.`);
  });

  test("preserves a Markdown image whose destination is not a file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image](./nonexistent-image.png)
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain("![An image](./nonexistent-image.png)");
  });

  test("preserves a Markdown image whose destination references a video", async () => {
    const source = `${FRONTMATTER}
      ![A video](./video.mp4)
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain("![A video](./video.mp4)");
  });

  test("preserves a Markdown image whose destination is an external URL", async () => {
    const source = `${FRONTMATTER}
      ![An image](https://example.com/image.png)
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain("![An image](https://example.com/image.png)");
  });

  test("renders a `<video>` as a link to the file the site serves, with its poster image as the link content", async () => {
    const source = `${FRONTMATTER}
      <video src="./video.mp4" controls />
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`[![](https://kuzmano.ski${VIDEO.posterImage.src})](https://kuzmano.ski${VIDEO.src})`);
  });

  test("renders a `<video>` with its `aria-label` attribute as the alternative text of its poster image", async () => {
    const source = `${FRONTMATTER}
      <video src="./video.mp4" aria-label="A video" />
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`![A video](https://kuzmano.ski${VIDEO.posterImage.src})`);
  });

  test("renders a `<video>` with a `<source>` child the same as one with a `src` attribute", async () => {
    const source = `${FRONTMATTER}
      <video controls>
        <source src="./video.mp4" type="video/mp4" />
      </video>
    `;
    const markdown = await markdownFor(source, { path: ENTRY_ABSOLUTE_PATH, mediaForEntry });
    expect(markdown).toContain(`[![](https://kuzmano.ski${VIDEO.posterImage.src})](https://kuzmano.ski${VIDEO.src})`);
  });
});
