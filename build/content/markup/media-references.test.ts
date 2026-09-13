import { describe, expect, test } from "vitest";

import { mediaReferencesInSource } from "./media-references.ts";

describe("mediaReferencesInSource", () => {
  const referencesIn = (source: string) => mediaReferencesInSource(source).map(({ reference }) => reference);
  const expectedKindsIn = (source: string) =>
    mediaReferencesInSource(source).map(({ reference, expected }) => ({ reference, expected }));
  const alternatesIn = (source: string) =>
    mediaReferencesInSource(source).map(({ reference, rendersAlternates }) => ({ reference, rendersAlternates }));

  test("returns the destination of a Markdown image", () => {
    expect(referencesIn("![An image](./image.png)\n")).toEqual(["./image.png"]);
  });

  test("returns the destination of a definition used by an image reference", () => {
    expect(referencesIn("![An image][d]\n\n[d]: ./image.png\n")).toEqual(["./image.png"]);
  });

  test("omits the destination of a definition used only by a link", () => {
    expect(referencesIn("[A link][d]\n\n[d]: ./page.md\n")).toEqual([]);
  });

  test("returns the `src` and `poster` attributes of authored markup", () => {
    const source = '<video poster="./video.poster.png" src="./video.mp4" />\n';
    expect(referencesIn(source)).toEqual(["./video.poster.png", "./video.mp4"]);
  });

  test("expects an image for the destination of a Markdown image", () => {
    expect(expectedKindsIn("![An image](./image.png)\n")).toEqual([{ reference: "./image.png", expected: "image" }]);
  });

  test("expects the `src` attribute of a `<video>` to reference a video and its `poster` attribute to reference an image", () => {
    expect(expectedKindsIn('<video poster="./video.poster.png" src="./video.mp4" />\n')).toEqual([
      { reference: "./video.poster.png", expected: "image" },
      { reference: "./video.mp4", expected: "video" },
    ]);
  });

  test("expects a video for the `src` attribute of a `<source>` inside a `<video>`", () => {
    expect(expectedKindsIn('<video>\n  <source src="./video.mp4" />\n</video>\n')).toEqual([
      { reference: "./video.mp4", expected: "video" },
    ]);
  });

  test("expects either kind for the `src` attribute of a `<source>` outside a `<video>`", () => {
    expect(expectedKindsIn('<source src="./video.mp4" />\n')).toEqual([{ reference: "./video.mp4", expected: null }]);
  });

  test("expects either kind for the `src` attribute of a component of the entry's own", () => {
    expect(expectedKindsIn('<Component src="./image.png" />\n')).toEqual([
      { reference: "./image.png", expected: null },
    ]);
  });

  test("returns each candidate in a `srcset` as a reference of its own", () => {
    const source = '<img srcSet="./image.png 1x, ./image@2x.png 2x" src="./image.png" />\n';
    expect(referencesIn(source)).toEqual(["./image.png", "./image@2x.png", "./image.png"]);
  });

  test("marks standalone Markdown and authored image references as rendering alternates", () => {
    const source =
      '![An image](./image-1.png)\n\n![An image][d]\n\n<img src="./image-3.png" />\n\n[d]: ./image-2.png\n';

    expect(alternatesIn(source)).toEqual([
      { reference: "./image-1.png", rendersAlternates: true },
      { reference: "./image-3.png", rendersAlternates: true },
      { reference: "./image-2.png", rendersAlternates: true },
    ]);
  });

  test("does not mark references in an authored `<picture>` as rendering alternates", () => {
    const source = `
      <picture>
        <source srcSet="./image-1.png 2x" />
        <img src="./image-2.png" />
      </picture>
    `;
    expect(alternatesIn(source)).toEqual([
      { reference: "./image-1.png", rendersAlternates: false },
      { reference: "./image-2.png", rendersAlternates: false },
    ]);
  });

  test("does not mark an authored `<img>` with a `srcSet` attribute of its own as rendering alternates", () => {
    expect(alternatesIn('<img srcSet="./image-1.png 1x, ./image-2.png 2x" src="./image-1.png" />\n')).toEqual([
      { reference: "./image-1.png", rendersAlternates: false },
      { reference: "./image-2.png", rendersAlternates: false },
      { reference: "./image-1.png", rendersAlternates: false },
    ]);
  });

  test("does not mark a Markdown image or an image reference inside an authored `<picture>` as rendering alternates", () => {
    const source = "<picture>\n\n![An image](./image-1.png)\n\n![An image][d]\n\n</picture>\n\n[d]: ./image-2.png\n";
    expect(alternatesIn(source)).toEqual([
      { reference: "./image-1.png", rendersAlternates: false },
      { reference: "./image-2.png", rendersAlternates: false },
    ]);
  });

  test("marks a definition as rendering alternates when an image reference outside an authored `<picture>` also uses it", () => {
    const source = "<picture>\n\n![An image][d]\n\n</picture>\n\n![An image][d]\n\n[d]: ./image.png\n";
    expect(alternatesIn(source)).toEqual([{ reference: "./image.png", rendersAlternates: true }]);
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
