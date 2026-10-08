import { createProcessor } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeImageGalleryChildren } from "./image-gallery-children.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = (source: string) =>
  createProcessor({ rehypePlugins: [rehypeImageGalleryChildren] }).process({ path: ENTRY_PATH, value: source });

describe("rehypeImageGalleryChildren", () => {
  test("accepts Markdown images on consecutive lines, `<img>` and `<picture>` elements, and a comment", async () => {
    await expect(
      compile(`<ImageGallery caption="A caption.">
  ![First image](./first.png)
  ![Second image](./second.png)
  {/* A comment. */}
  <img src="./third.png" alt="Third image" />
  <picture>
    <img src="./fourth.png" alt="Fourth image" />
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
      '"content/collection/entry.mdx" renders an `ImageGallery` with a `<video>` element. Expected one or more images, authored in Markdown or as `<img>` or `<picture>` elements.',
    );
  });

  test("throws for an `ImageGallery` with text beside its images, naming the text", async () => {
    await expect(
      compile(`<ImageGallery>
  ![First image](./first.png) and a sentence.
</ImageGallery>
`),
    ).rejects.toThrow('renders an `ImageGallery` with the text "and a sentence."');
  });

  test("throws for an `ImageGallery` without an image, naming the entry", async () => {
    await expect(compile(`<ImageGallery caption="A caption." />`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders an `ImageGallery` without an image.',
    );
  });
});
