import { createProcessor } from "@mdx-js/mdx";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { describe, expect, test, vi } from "vitest";

import type { ContentImage, ContentMedia, ContentVideo, SizedMedia } from "#/lib/content/media.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { ENTRY_ABSOLUTE_PATH, MEDIA_FILE_HASH } from "../../test-utils/media.ts";

import { rehypeMedia } from "./media-rewrite.ts";

import type { MediaForEntry, MediaForReference } from "./media-rewrite.ts";
import type { ContentNode, ContentParent } from "./tree.ts";
import type { Root } from "hast";
import type { PluggableList } from "unified";

const servedUrl = (name: string, extension: string) =>
  mediaRoute(`collection/entry/${name}.${MEDIA_FILE_HASH}.${extension}`);

const IMAGE_WITH_ALTERNATES: ContentImage = {
  kind: "image",
  src: servedUrl("image", "png"),
  width: 900,
  height: 500,
  alternates: [
    { srcSet: servedUrl("image", "avif"), type: "image/avif" },
    { srcSet: servedUrl("image", "webp"), type: "image/webp" },
  ],
};
const IMAGE_WITHOUT_ALTERNATES: ContentImage = {
  kind: "image",
  src: servedUrl("image", "jpg"),
  width: 1200,
  height: 800,
  alternates: [],
};
const HI_DPI_IMAGE: ContentImage = {
  kind: "image",
  src: servedUrl("image@2x", "jpg"),
  width: 2400,
  height: 1600,
  alternates: [],
};
const POSTER_IMAGE: SizedMedia = {
  src: servedUrl("video.poster", "webp"),
  width: 640,
  height: 360,
};
const VIDEO: ContentVideo = {
  kind: "video",
  src: servedUrl("video", "mp4"),
  width: 1280,
  height: 720,
  posterImage: POSTER_IMAGE,
};
const MEDIA: Record<string, ContentMedia> = {
  "./image.png": IMAGE_WITH_ALTERNATES,
  "./image.jpg": IMAGE_WITHOUT_ALTERNATES,
  "./image@2x.jpg": HI_DPI_IMAGE,
  "./video.poster.webp": { kind: "image", ...POSTER_IMAGE, alternates: [] }, // A poster image referenced directly resolves as an image.
  "./video.mp4": VIDEO,
};
const UNRESOLVED_REFERENCES = new Set(["./missing-image.png", "./missing-video.mp4"]);

const entryMedia: MediaForReference = (reference) => {
  const resolvedMedia = MEDIA[reference] ?? null;

  if (!resolvedMedia && !UNRESOLVED_REFERENCES.has(reference)) {
    throw new Error(`The fixtures have no media for "${reference}".`);
  }

  return resolvedMedia;
};

const mediaForEntry: MediaForEntry = (absolutePath) =>
  Promise.resolve(absolutePath === ENTRY_ABSOLUTE_PATH ? entryMedia : () => null);

// Compile source through the same MDX pipeline shape used by `mdx.ts`.
//
// Explicitly authored JSX produces `mdxJsxFlowElement` and `mdxJsxTextElement` nodes. Markdown images produce a
// hast `element`. Using `fromHtml` would not cover either JSX node type. Keep `rehypeMedia` first, as in
// `mdx.ts`. Later plugins only add heading links and syntax highlighting.
async function compiledTree(source: string, resolve: MediaForEntry = mediaForEntry): Promise<ContentParent> {
  let transformedTree: ContentParent = { type: "root", children: [] };

  const capture = () => (tree: ContentParent) => {
    transformedTree = tree;
  };
  const rehypePlugins: PluggableList = [[rehypeMedia, resolve], capture];

  await createProcessor({ rehypePlugins }).process({ value: source, path: ENTRY_ABSOLUTE_PATH });

  return transformedTree;
}

const nodesIn = (tree: ContentParent, matches: (node: ContentNode) => boolean): Array<ContentNode> => {
  const matchingNodes: Array<ContentNode> = [];

  visit(tree, (node: ContentNode) => {
    if (matches(node)) {
      matchingNodes.push(node);
    }
  });

  return matchingNodes;
};

const elementsNamed = (tree: ContentParent, tagName: string) => nodesIn(tree, (node) => node.tagName === tagName);
const jsxElementsNamed = (tree: ContentParent, name: string) => nodesIn(tree, (node) => node.name === name);
const attributeOf = (node: ContentNode | undefined, name: string) =>
  node?.attributes?.find((attribute) => attribute.name === name)?.value;

describe("rehypeMedia", () => {
  test("looks up an entry's media once, regardless of how many references the entry contains", async () => {
    const resolve = vi.fn(mediaForEntry);
    const source = `
      ![An image](./image.png)

      <video src="./video.mp4" poster="./video.poster.webp" />
    `;

    await compiledTree(source, resolve);

    expect(resolve.mock.calls).toEqual([[ENTRY_ABSOLUTE_PATH]]);
  });

  test("wraps a Markdown image in a `<picture>` with a `<source>` for each alternate format", async () => {
    const [picture, ...others] = elementsNamed(await compiledTree("![An image](./image.png)\n"), "picture");

    expect(others).toHaveLength(0);
    expect(picture?.children?.map((child) => child.tagName)).toEqual(["source", "source", "img"]);
    expect(picture?.children?.slice(0, 2).map((child) => child.properties)).toEqual([
      { srcSet: IMAGE_WITH_ALTERNATES.alternates[0]!.srcSet, type: "image/avif" },
      { srcSet: IMAGE_WITH_ALTERNATES.alternates[1]!.srcSet, type: "image/webp" },
    ]);
  });

  test("renders a Markdown image it wraps in a `<picture>` as its `<source>` elements followed by the `<img>`", async () => {
    expect(toHtml((await compiledTree("![An image](./image.png)\n")) as Root)).toBe(
      `<p><picture><source srcset="${IMAGE_WITH_ALTERNATES.alternates[0]!.srcSet}" type="image/avif"><source srcset="${IMAGE_WITH_ALTERNATES.alternates[1]!.srcSet}" type="image/webp"><img src="${IMAGE_WITH_ALTERNATES.src}" alt="An image" width="900" height="500" loading="lazy" decoding="async"></picture></p>`,
    );
  });

  test("rewrites a Markdown image to the file the site serves, at its intrinsic size", async () => {
    const tree = await compiledTree("![An image](./image.png)\n");
    expect(elementsNamed(tree, "img")[0]?.properties).toEqual({
      src: IMAGE_WITH_ALTERNATES.src,
      alt: "An image",
      width: IMAGE_WITH_ALTERNATES.width,
      height: IMAGE_WITH_ALTERNATES.height,
      loading: "lazy",
      decoding: "async",
    });
  });

  test("wraps every Markdown image in a separate `<picture>`", async () => {
    const tree = await compiledTree(`
      ![First image](./image.png)

      ![Second image](./image.png)
    `);

    expect(elementsNamed(tree, "picture")).toHaveLength(2);
    expect(elementsNamed(tree, "img")).toHaveLength(2);
  });

  test("renders a Markdown image without alternate formats as an `<img>` without a `<picture>` wrapper", async () => {
    const tree = await compiledTree("![An image](./image.jpg)\n");

    expect(elementsNamed(tree, "picture")).toHaveLength(0);
    expect(elementsNamed(tree, "img")[0]?.properties).toMatchObject({
      src: IMAGE_WITHOUT_ALTERNATES.src,
      width: IMAGE_WITHOUT_ALTERNATES.width,
    });
  });

  test("resolves an image reference through its definition to the file the site serves", async () => {
    const tree = await compiledTree(`
      ![An image][definition]

      [definition]: ./image.png
    `);
    expect(elementsNamed(tree, "img")[0]?.properties).toMatchObject({
      src: IMAGE_WITH_ALTERNATES.src,
      alt: "An image",
    });
  });

  test("leaves a Markdown image with an unresolved reference as written", async () => {
    const tree = await compiledTree("![An image](./missing-image.png)\n");
    expect(elementsNamed(tree, "img")[0]?.properties).toEqual({ src: "./missing-image.png", alt: "An image" });
  });

  test("leaves a Markdown image with a root-relative or external URL as written", async () => {
    const tree = await compiledTree(`
      ![First image](/absolute.png)

      ![Second image](https://example.com/external.png)
    `);
    expect(elementsNamed(tree, "img").map((image) => image.properties?.src)).toEqual([
      "/absolute.png",
      "https://example.com/external.png",
    ]);
  });

  test("wraps an authored `<img>` in a `<picture>` with a `<source>` for each alternate format", async () => {
    const [picture, ...others] = elementsNamed(
      await compiledTree('<img src="./image.png" alt="An image" />\n'),
      "picture",
    );

    expect(others).toHaveLength(0);
    expect(picture?.children?.map((child) => child.tagName ?? child.name)).toEqual(["source", "source", "img"]);
    expect(picture?.children?.slice(0, 2).map((child) => child.properties?.type)).toEqual(["image/avif", "image/webp"]);
  });

  test("rewrites the `src` attribute of an authored `<img>` to the file the site serves, and does not add `loading` or `decoding` attributes", async () => {
    const [image] = jsxElementsNamed(await compiledTree('<img src="./image.png" alt="An image" />\n'), "img");

    expect(image?.attributes?.map(({ name }) => name)).toEqual(["src", "alt", "width", "height"]);
    expect(attributeOf(image, "src")).toBe(IMAGE_WITH_ALTERNATES.src);
  });

  test("sets the `width` and `height` attributes of an authored `<img>` to the dimensions of the image", async () => {
    const [image] = jsxElementsNamed(await compiledTree('<img src="./image.png" alt="An image" />\n'), "img");

    expect(attributeOf(image, "width")).toBe("900");
    expect(attributeOf(image, "height")).toBe("500");
  });

  test("sets the `width` and `height` attributes of an authored `<img>` written inside a sentence", async () => {
    const [image] = jsxElementsNamed(
      await compiledTree('Text with an <img src="./image.jpg" alt="An image" /> in it.\n'),
      "img",
    );

    expect(attributeOf(image, "width")).toBe("1200");
    expect(attributeOf(image, "height")).toBe("800");
  });

  test("preserves the `width` attribute written on an authored `<img>`, and does not set a `height` attribute", async () => {
    const [image] = jsxElementsNamed(
      await compiledTree('<img src="./image.png" alt="An image" width="450" />\n'),
      "img",
    );

    expect(attributeOf(image, "width")).toBe("450");
    expect(attributeOf(image, "height")).toBeUndefined();
  });

  test("preserves the `height` attribute written on an authored `<img>`, and does not set a `width` attribute", async () => {
    const [image] = jsxElementsNamed(
      await compiledTree('<img src="./image.png" alt="An image" height="250" />\n'),
      "img",
    );

    expect(attributeOf(image, "width")).toBeUndefined();
    expect(attributeOf(image, "height")).toBe("250");
  });

  test("does not set the `width` or `height` attribute of an authored `<img>` with a spread attribute", async () => {
    const [image] = jsxElementsNamed(
      await compiledTree('<img src="./image.png" alt="An image" {...props} />\n'),
      "img",
    );

    expect(attributeOf(image, "width")).toBeUndefined();
    expect(attributeOf(image, "height")).toBeUndefined();
  });

  test("does not set the `width` or `height` attribute of an authored `<img>` whose `src` attribute is unresolved", async () => {
    const [image] = jsxElementsNamed(await compiledTree('<img src="./missing-image.png" alt="An image" />\n'), "img");
    expect(image?.attributes?.map(({ name }) => name)).toEqual(["src", "alt"]);
  });

  test("preserves authored `<img>` attributes when wrapping the image in a `<picture>`", async () => {
    const tree = await compiledTree('<img src="./image.png" alt="An image" width="450" loading="eager" />\n');
    const [picture] = elementsNamed(tree, "picture");
    const [image] = jsxElementsNamed(tree, "img");

    expect(picture?.children?.at(-1)).toBe(image);
    expect(image?.attributes?.map(({ name, value }) => [name, value])).toEqual([
      ["src", IMAGE_WITH_ALTERNATES.src],
      ["alt", "An image"],
      ["width", "450"],
      ["loading", "eager"],
    ]);
  });

  test("moves the `data-content-*` attributes of an authored `<img>` to the `<picture>` that wraps it", async () => {
    const tree = await compiledTree(
      '<img src="./image.png" alt="An image" data-content-span="wide" data-content-space="loose" data-other="value" />\n',
    );
    const [picture] = elementsNamed(tree, "picture");
    const [image] = jsxElementsNamed(tree, "img");

    expect(picture?.properties).toEqual({ "data-content-span": "wide", "data-content-space": "loose" });
    expect(image?.attributes?.map(({ name }) => name)).toEqual(["src", "alt", "data-other", "width", "height"]);
  });

  test("preserves the `data-content-*` attributes of an authored `<img>` that is not wrapped in a `<picture>`", async () => {
    const [image] = jsxElementsNamed(
      await compiledTree('<img src="./image.jpg" alt="An image" data-content-span="wide" />\n'),
      "img",
    );
    expect(image?.attributes?.map(({ name }) => name)).toContain("data-content-span");
  });

  test("does not wrap an authored `<img>` with a `srcSet` attribute of its own in a `<picture>`", async () => {
    const tree = await compiledTree(
      '<img srcSet="./image.jpg 1x, ./image@2x.jpg 2x" src="./image.png" alt="An image" />\n',
    );

    expect(elementsNamed(tree, "picture")).toHaveLength(0);
    expect(attributeOf(jsxElementsNamed(tree, "img")[0], "srcSet")).toBe(
      `${IMAGE_WITHOUT_ALTERNATES.src} 1x, ${HI_DPI_IMAGE.src} 2x`,
    );
  });

  test("does not wrap an authored `<img>` with a spread attribute in a `<picture>`", async () => {
    const tree = await compiledTree('<img src="./image.png" alt="An image" {...props} />\n');

    expect(elementsNamed(tree, "picture")).toHaveLength(0);
    expect(attributeOf(jsxElementsNamed(tree, "img")[0], "src")).toBe(IMAGE_WITH_ALTERNATES.src);
  });

  test("preserves the elements of an authored `<picture>`, and rewrites every reference in it", async () => {
    const tree = await compiledTree(`
      <picture>
        <source srcSet="./image.jpg 1x, ./image@2x.jpg 2x" type="image/jpeg" />
        <img src="./image.jpg" alt="An image" />
      </picture>
    `);

    expect(jsxElementsNamed(tree, "picture")).toHaveLength(1);
    expect(attributeOf(jsxElementsNamed(tree, "source")[0], "srcSet")).toBe(
      `${IMAGE_WITHOUT_ALTERNATES.src} 1x, ${HI_DPI_IMAGE.src} 2x`,
    );
    expect(attributeOf(jsxElementsNamed(tree, "img")[0], "src")).toBe(IMAGE_WITHOUT_ALTERNATES.src);
  });

  test("sets the `width` and `height` attributes of an authored `<img>` in a `<picture>`", async () => {
    const tree = await compiledTree(`
      <picture>
        <source srcSet="./image@2x.jpg" type="image/jpeg" />
        <img src="./image.jpg" alt="An image" />
      </picture>
    `);
    const [image] = jsxElementsNamed(tree, "img");

    expect(attributeOf(image, "width")).toBe("1200");
    expect(attributeOf(image, "height")).toBe("800");
  });

  test("rewrites the `poster` and `src` attributes of a `<video>` to the files the site serves", async () => {
    const tree = await compiledTree('<video poster="./video.poster.webp" src="./video.mp4" />\n');

    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "poster")).toBe(POSTER_IMAGE.src);
    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "src")).toBe(VIDEO.src);
  });

  test("sets the `poster` attribute of a `<video>` to the poster image paired with the video", async () => {
    const tree = await compiledTree('<video src="./video.mp4" controls />\n');
    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "poster")).toBe(POSTER_IMAGE.src);
  });

  test("sets the `width` and `height` attributes of a `<video>` to the dimensions of the video", async () => {
    const video = jsxElementsNamed(await compiledTree('<video src="./video.mp4" />\n'), "video")[0];

    expect(attributeOf(video, "width")).toBe("1280");
    expect(attributeOf(video, "height")).toBe("720");
  });

  test("preserves the `width` attribute written on a `<video>`, and does not set a `height` attribute", async () => {
    const [video] = jsxElementsNamed(await compiledTree('<video src="./video.mp4" width="480" />\n'), "video");

    expect(attributeOf(video, "width")).toBe("480");
    expect(attributeOf(video, "height")).toBeUndefined();
  });

  test("does not set the `width` or `height` attribute of a `<video>` with a spread attribute", async () => {
    const [video] = jsxElementsNamed(await compiledTree('<video src="./video.mp4" {...props} />\n'), "video");

    expect(attributeOf(video, "width")).toBeUndefined();
    expect(attributeOf(video, "height")).toBeUndefined();
  });

  test("sets the `poster`, `width`, and `height` attributes of a `<video>` whose `<source>` references a video", async () => {
    const tree = await compiledTree(`
      <video controls>
        <source src="./video.mp4" type="video/mp4" />
      </video>
    `);
    const [video] = jsxElementsNamed(tree, "video");

    expect(attributeOf(video, "poster")).toBe(POSTER_IMAGE.src);
    expect(attributeOf(video, "width")).toBe("1280");
    expect(attributeOf(video, "height")).toBe("720");
    expect(attributeOf(jsxElementsNamed(tree, "source")[0], "src")).toBe(VIDEO.src);
  });

  test("leaves a `<video>` with an unresolved reference as written", async () => {
    const tree = await compiledTree('<video src="./missing-video.mp4" />\n');

    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "src")).toBe("./missing-video.mp4");
    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "poster")).toBeUndefined();
  });

  test("leaves a Markdown image whose destination references a video as written", async () => {
    const [image] = elementsNamed(await compiledTree("![A video](./video.mp4)\n"), "img");

    expect(image?.properties?.src).toBe("./video.mp4");
    expect(image?.properties?.width).toBeUndefined();
  });

  test("leaves an authored `<img>` whose `src` attribute references a video as written", async () => {
    const tree = await compiledTree('<img src="./video.mp4" alt="A video" />\n');
    expect(attributeOf(jsxElementsNamed(tree, "img")[0], "src")).toBe("./video.mp4");
  });

  test("leaves a `<video>` whose `<source>` references an image as written", async () => {
    const tree = await compiledTree(`
      <video controls>
        <source src="./image.png" type="video/mp4" />
      </video>
    `);

    expect(attributeOf(jsxElementsNamed(tree, "source")[0], "src")).toBe("./image.png");
    expect(attributeOf(jsxElementsNamed(tree, "video")[0], "poster")).toBeUndefined();
  });

  test("rewrites an authored `<img>` written inside a sentence, and wraps it in a `<picture>` inside the paragraph", async () => {
    const tree = await compiledTree('Text with an <img src="./image.png" alt="An image" /> in it.\n');

    expect(jsxElementsNamed(tree, "img")[0]?.type).toBe("mdxJsxTextElement");
    expect(attributeOf(jsxElementsNamed(tree, "img")[0], "src")).toBe(IMAGE_WITH_ALTERNATES.src);
    expect(elementsNamed(tree, "p")[0]?.children?.map((child) => child.tagName ?? child.type)).toEqual([
      "text",
      "picture",
      "text",
    ]);
  });

  test("does not wrap a Markdown image inside an authored `<picture>` in a second `<picture>`", async () => {
    // MDX preserves `<picture>` as JSX and wraps its image in a paragraph.
    const tree = await compiledTree(`
      <picture>

      ![An image](./image.png)

      </picture>
    `);

    expect(jsxElementsNamed(tree, "picture")).toHaveLength(1);
    expect(elementsNamed(tree, "picture")).toHaveLength(0);
    expect(elementsNamed(tree, "img")[0]?.properties?.src).toBe(IMAGE_WITH_ALTERNATES.src);
  });

  test("does not wrap an `<img>` already inside a `<picture>` in a second `<picture>`", async () => {
    const tree = fromHtml('<picture><img src="./image.png" alt="An image"></picture>', { fragment: true });

    await rehypeMedia(mediaForEntry)(tree, { path: ENTRY_ABSOLUTE_PATH });

    expect(toHtml(tree)).toBe(
      `<picture><img src="${IMAGE_WITH_ALTERNATES.src}" alt="An image" width="900" height="500" loading="lazy" decoding="async"></picture>`,
    );
  });
});
