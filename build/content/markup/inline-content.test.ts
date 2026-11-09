import { createProcessor } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeInlineContent } from "./inline-content.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = async (source: string) =>
  String(
    await createProcessor({ jsx: true, rehypePlugins: [rehypeInlineContent] }).process({
      path: ENTRY_PATH,
      value: source,
    }),
  );
const renderedJsxOf = (compiled: string) => /return (<[^]*>);\n}/.exec(compiled)?.[1];

describe("rehypeInlineContent", () => {
  test("removes the paragraphs around Markdown inside a component that accepts only inline content, and separates children authored on their own lines with a line break", async () => {
    expect(
      renderedJsxOf(
        await compile(`<ImageRow>
  ![First image](./first.png)

  [![Second image](./second.png)](/page)

  <AlertButton message="A message.">
    ![Third image](./third.png)
  </AlertButton>
</ImageRow>
`),
      ),
    ).toBe(
      '<ImageRow><_components.img src="./first.png" alt="First image" />{"\\n"}<_components.a href="/page"><_components.img src="./second.png" alt="Second image" /></_components.a>{"\\n"}<AlertButton message="A message."><_components.img src="./third.png" alt="Third image" /></AlertButton></ImageRow>',
    );
  });

  test("removes a paragraph of images authored on consecutive lines, and leaves the line break between them unchanged", async () => {
    expect(
      renderedJsxOf(
        await compile(`<ImageRow>
  ![First image](./first.png)
  ![Second image](./second.png)
</ImageRow>
`),
      ),
    ).toBe(
      '<ImageRow><_components.img src="./first.png" alt="First image" />{"\\n"}<_components.img src="./second.png" alt="Second image" /></ImageRow>',
    );
  });

  test("separates the text of consecutive paragraphs it removes with a line break", async () => {
    expect(
      renderedJsxOf(
        await compile(`<AlertButton message="A message.">
  The first paragraph.

  The second paragraph.
</AlertButton>
`),
      ),
    ).toBe('<AlertButton message="A message.">{"The first paragraph."}{"\\n"}{"The second paragraph."}</AlertButton>');
  });

  test("removes the paragraphs inside an element that accepts only inline content, and inside an `<a>` within one", async () => {
    expect(
      renderedJsxOf(
        await compile(`<button>
  <a href="/page">
    A link.
  </a>
</button>
`),
      ),
    ).toBe('<button><a href="/page">{"A link."}</a></button>');
  });

  test("leaves the paragraphs inside a component that accepts blocks, and inside an `<a>` outside inline content, unchanged", async () => {
    expect(
      renderedJsxOf(
        await compile(`<Callout>
  A paragraph.
</Callout>

<a href="/page">
  A paragraph.
</a>
`),
      ),
    ).toBe(
      '<><Callout><_components.p>{"A paragraph."}</_components.p></Callout>{"\\n"}<a href="/page"><_components.p>{"A paragraph."}</_components.p></a></>',
    );
  });

  test("accepts inline elements and inline components inside a paragraph", async () => {
    await expect(
      compile(`A sentence with <kbd>K</kbd>, a <my-element>custom element</my-element>, and an <AlertButton message="A message.">alert button</AlertButton>.

![An image](./image.png)
<sup>A note.</sup>
`),
    ).resolves.toBeDefined();
  });

  test("accepts a fragment of inline content inside a paragraph", async () => {
    await expect(compile(`A sentence with <>a fragment</> inside it.\n`)).resolves.toBeDefined();
  });

  test("throws for a block inside a fragment inside a paragraph, naming the paragraph", async () => {
    await expect(compile(`A sentence with <><div>a block</div></> inside it.\n`)).rejects.toThrow(
      "renders `<div>` inside a paragraph on line 1.",
    );
  });

  test("throws for a block on the line after Markdown, naming the entry, the element, and the line", async () => {
    await expect(
      compile(`<figure>
  ![An image](./image.png)
  <figcaption>A caption.</figcaption>
</figure>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `<figcaption>` inside a paragraph on line 3. Expected a blank line between the paragraph and the element.',
    );
  });

  test("throws for a block component inside a paragraph", async () => {
    await expect(
      compile(`A paragraph.
<Aside label="Aside">An aside.</Aside>
`),
    ).rejects.toThrow("renders `Aside` inside a paragraph on line 2.");
  });

  test("throws for a block inside a component that accepts only inline content, naming the component", async () => {
    await expect(
      compile(`<ImageRow>
  <div>An image row item.</div>
</ImageRow>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `<div>` inside `ImageRow` on line 2. Expected inline content (e.g., text, images, and links).',
    );
  });

  test('throws for a block inside a heading, naming an element that starts with a vowel with "an"', async () => {
    await expect(
      compile(`## A heading <article>A block.</article>
`),
    ).rejects.toThrow("renders `<article>` inside `<h2>` on line 1.");
  });

  test("ignores a block among the children of an `ImageGallery`, which `rehypeImageChildren` checks", async () => {
    await expect(
      compile(`<ImageGallery>
  ![An image](./image.png)

  <div>A block.</div>
</ImageGallery>
`),
    ).resolves.toBeDefined();
  });

  test("throws for a block inside an `<a>` inside a paragraph", async () => {
    await expect(
      compile(`A sentence with <a href="/page"><div>a block</div></a>.
`),
    ).rejects.toThrow("renders `<div>` inside `<a>` on line 1.");
  });
});
