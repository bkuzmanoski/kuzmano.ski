import { createProcessor } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeImageChildren } from "./image-children.ts";
import { rehypeInlineContent } from "./inline-content.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = (source: string) =>
  createProcessor({ rehypePlugins: [rehypeInlineContent, rehypeImageChildren] }).process({
    path: ENTRY_PATH,
    value: source,
  });

describe("rehypeImageChildren", () => {
  test("accepts Markdown images, `<img>` and `<picture>` elements, and a comment", async () => {
    await expect(
      compile(`<ImageGallery caption="A caption.">
  ![First image](./first.png)

  {/* A comment. */}

  <img src="./second.png" alt="Second image" />

  <picture>
    <img src="./third.png" alt="Third image" />
  </picture>
</ImageGallery>
`),
    ).resolves.toBeDefined();
  });

  test("throws for an `ImageGallery` with a child element other than an image, naming the entry and the element", async () => {
    await expect(
      compile(`<ImageGallery>
  <img src="./first.png" alt="First image" />

  <video src="./video.mp4" />
</ImageGallery>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `ImageGallery` with `<video>` as a child. Expected one or more images, authored in Markdown or as `<img>` or `<picture>` elements.',
    );
  });

  test("throws for an `ImageGallery` with a block child, naming the element", async () => {
    // `rehypeInlineContent` does not report a block among the children of an `ImageGallery`, so this message names what
    // a gallery accepts.
    await expect(
      compile(`<ImageGallery>
  ![First image](./first.png)

  <div>A block.</div>
</ImageGallery>
`),
    ).rejects.toThrow("renders `ImageGallery` with `<div>` as a child. Expected one or more images");
  });

  test.each([
    ["a component", "<Callout>A callout.</Callout>", "with `Callout` as a child."],
    ["a fragment", "<>![Second image](./second.png)</>", "with a fragment."],
  ])("throws for an `ImageGallery` with %s as a child, naming it", async (_label, child, description) => {
    await expect(
      compile(`<ImageGallery>
  ![First image](./first.png)

  ${child}
</ImageGallery>
`),
    ).rejects.toThrow(description);
  });

  test("throws for an `ImageGallery` with text beside its images, naming the text", async () => {
    await expect(
      compile(`<ImageGallery>
  ![First image](./first.png) and a sentence.
</ImageGallery>
`),
    ).rejects.toThrow('renders `ImageGallery` with the text "and a sentence."');
  });

  test("throws for an `ImageGallery` without an image, naming the entry", async () => {
    await expect(compile(`<ImageGallery caption="A caption." />`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders `ImageGallery` without an image.',
    );
  });
});
