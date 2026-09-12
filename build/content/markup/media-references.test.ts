import { describe, expect, test } from "vitest";

import { mediaReferencesInSource } from "./media-references.ts";

describe("mediaReferencesInSource", () => {
  const referencesIn = (source: string) => mediaReferencesInSource(source).map(({ reference }) => reference);
  const expectedKindsIn = (source: string) =>
    mediaReferencesInSource(source).map(({ reference, expected }) => ({ reference, expected }));

  test("returns the destination of a Markdown image", () => {
    expect(referencesIn("![An image](./image.png)\n")).toEqual(["./image.png"]);
  });

  test("returns the destination of a definition used by an image reference", () => {
    expect(referencesIn("![An image][d]\n\n[d]: ./image.png\n")).toEqual(["./image.png"]);
  });

  test("omits the destination of a definition used only by a link", () => {
    expect(referencesIn("[A link][d]\n\n[d]: ./page.md\n")).toEqual([]);
  });

  test("returns the `src` and `poster` of authored markup", () => {
    const source = '<video poster="./video.poster.png" src="./video.mp4" />\n';
    expect(referencesIn(source)).toEqual(["./video.poster.png", "./video.mp4"]);
  });

  test("expects an image for the destination of a Markdown image", () => {
    expect(expectedKindsIn("![An image](./image.png)\n")).toEqual([{ reference: "./image.png", expected: "image" }]);
  });

  test("expects a video for the `src` of a `<video>`, and an image for its `poster`", () => {
    expect(expectedKindsIn('<video poster="./video.poster.png" src="./video.mp4" />\n')).toEqual([
      { reference: "./video.poster.png", expected: "image" },
      { reference: "./video.mp4", expected: "video" },
    ]);
  });

  test("expects a video for the `src` of a `<source>` inside a `<video>`", () => {
    expect(expectedKindsIn('<video>\n  <source src="./video.mp4" />\n</video>\n')).toEqual([
      { reference: "./video.mp4", expected: "video" },
    ]);
  });

  test("expects either kind for the `src` of a `<source>` outside a `<video>`", () => {
    expect(expectedKindsIn('<source src="./video.mp4" />\n')).toEqual([{ reference: "./video.mp4", expected: null }]);
  });

  test("expects either kind for the `src` of a component of the entry's own", () => {
    expect(expectedKindsIn('<Component src="./image.png" />\n')).toEqual([
      { reference: "./image.png", expected: null },
    ]);
  });

  test("returns each candidate in a `srcset` as a reference of its own", () => {
    const source = '<img srcSet="./image.png 1x, ./image@2x.png 2x" src="./image.png" />\n';
    expect(referencesIn(source)).toEqual(["./image.png", "./image@2x.png", "./image.png"]);
  });

  test("omits an absolute, root-relative, or external reference", () => {
    const source =
      "![An image](https://example.com/image.png)\n\n![An image](/image.png)\n\n![An image](data:image/gif;base64,AA)\n";
    expect(referencesIn(source)).toEqual([]);
  });

  test("omits an attribute whose value is a JSX expression", () => {
    expect(referencesIn("<img src={image} />\n")).toEqual([]);
  });

  test("returns references in document order", () => {
    expect(referencesIn("![First image](./image-1.png)\n\n![Second image](./image-2.png)\n")).toEqual([
      "./image-1.png",
      "./image-2.png",
    ]);
  });
});
