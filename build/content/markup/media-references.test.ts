import { describe, expect, test } from "vitest";

import { mediaReferencesInSource } from "./media-references.ts";

describe("mediaReferencesInSource", () => {
  const referencesIn = (source: string) => mediaReferencesInSource(source).map(({ reference }) => reference);
  const expectedKindsIn = (source: string) =>
    mediaReferencesInSource(source).map(({ reference, expected }) => ({ reference, expected }));
  const canRenderAlternatesIn = (source: string) =>
    mediaReferencesInSource(source).map(({ reference, canRenderAlternates }) => ({ reference, canRenderAlternates }));

  test("returns the destination of a Markdown image", () => {
    expect(referencesIn("![An image](./image.png)\n")).toEqual(["./image.png"]);
  });

  test("returns the destination of a definition used by an image reference", () => {
    const source = `
      ![An image][definition]

      [definition]: ./image.png
    `;
    expect(referencesIn(source)).toEqual(["./image.png"]);
  });

  test("omits the destination of a definition used only by a link", () => {
    const source = `
      [A link][definition]

      [definition]: ./page.md
    `;
    expect(referencesIn(source)).toEqual([]);
  });

  test("returns the values of the `src` and `poster` attributes in authored markup", () => {
    const source = '<video poster="./video.poster.png" src="./video.mp4" />\n';
    expect(referencesIn(source)).toEqual(["./video.poster.png", "./video.mp4"]);
  });

  test("expects an image for the destination of a Markdown image", () => {
    expect(expectedKindsIn("![An image](./image.png)\n")).toEqual([{ reference: "./image.png", expected: "image" }]);
  });

  test("expects a video for the `src` attribute of a `<video>`, and an image for its `poster` attribute", () => {
    expect(expectedKindsIn('<video poster="./video.poster.png" src="./video.mp4" />\n')).toEqual([
      { reference: "./video.poster.png", expected: "image" },
      { reference: "./video.mp4", expected: "video" },
    ]);
  });

  test("expects a video for the `src` attribute of a `<source>` inside a `<video>`", () => {
    const source = `
      <video>
        <source src="./video.mp4" />
      </video>
    `;
    expect(expectedKindsIn(source)).toEqual([{ reference: "./video.mp4", expected: "video" }]);
  });

  test("expects either kind for the `src` attribute of a `<source>` outside a `<video>`", () => {
    expect(expectedKindsIn('<source src="./video.mp4" />\n')).toEqual([{ reference: "./video.mp4", expected: null }]);
  });

  test("expects either kind for the `src` attribute of a component of the entry's own", () => {
    expect(expectedKindsIn('<Component src="./image.png" />\n')).toEqual([
      { reference: "./image.png", expected: null },
    ]);
  });

  test("returns each candidate in a `srcSet` attribute as a reference of its own", () => {
    const source = '<img srcSet="./image.png 1x, ./image@2x.png 2x" src="./image.png" />\n';
    expect(referencesIn(source)).toEqual(["./image.png", "./image@2x.png", "./image.png"]);
  });

  test("marks a Markdown image, an image reference's definition, and an authored `<img>` outside a `<picture>` as able to render alternates", () => {
    const source = `
      ![An image](./image-1.png)

      ![An image][definition]

      <img src="./image-3.png" />

      [definition]: ./image-2.png
    `;
    expect(canRenderAlternatesIn(source)).toEqual([
      { reference: "./image-1.png", canRenderAlternates: true },
      { reference: "./image-3.png", canRenderAlternates: true },
      { reference: "./image-2.png", canRenderAlternates: true },
    ]);
  });

  test("marks an authored `<img>` inside a component as able to render alternates", () => {
    expect(canRenderAlternatesIn('<Component><img src="./image.png" /></Component>\n')).toEqual([
      { reference: "./image.png", canRenderAlternates: true },
    ]);
  });

  test("does not mark references in an authored `<picture>` as able to render alternates", () => {
    const source = `
      <picture>
        <source srcSet="./image-1.png 2x" />
        <img src="./image-2.png" />
      </picture>
    `;
    expect(canRenderAlternatesIn(source)).toEqual([
      { reference: "./image-1.png", canRenderAlternates: false },
      { reference: "./image-2.png", canRenderAlternates: false },
    ]);
  });

  test.each(["srcSet", "srcset"])(
    "does not mark an authored `<img>` with a `%s` attribute of its own as able to render alternates",
    (attribute) => {
      const source = `<img ${attribute}="./image-1.png 1x, ./image-2.png 2x" src="./image-1.png" />\n`;
      expect(canRenderAlternatesIn(source)).toEqual([
        { reference: "./image-1.png", canRenderAlternates: false },
        { reference: "./image-2.png", canRenderAlternates: false },
        { reference: "./image-1.png", canRenderAlternates: false },
      ]);
    },
  );

  test("does not mark an authored `<img>` with a spread attribute, which can set a `srcSet` attribute, as able to render alternates", () => {
    expect(canRenderAlternatesIn('<img src="./image.png" {...props} />\n')).toEqual([
      { reference: "./image.png", canRenderAlternates: false },
    ]);
  });

  test("does not mark a Markdown image or an image reference inside an authored `<picture>` as able to render alternates", () => {
    const source = `
      <picture>

      ![An image](./image-1.png)

      ![An image][definition]

      </picture>

      [definition]: ./image-2.png
    `;
    expect(canRenderAlternatesIn(source)).toEqual([
      { reference: "./image-1.png", canRenderAlternates: false },
      { reference: "./image-2.png", canRenderAlternates: false },
    ]);
  });

  test("marks a definition as able to render alternates when an image reference outside an authored `<picture>` also uses it", () => {
    const source = `
      <picture>

      ![An image][definition]

      </picture>

      ![An image][definition]

      [definition]: ./image.png
    `;
    expect(canRenderAlternatesIn(source)).toEqual([{ reference: "./image.png", canRenderAlternates: true }]);
  });

  test("omits root-relative, external, and data URI references", () => {
    const source = `
      ![An image](https://example.com/image.png)

      ![An image](/image.png)

      ![An image](data:image/gif;base64,AA)
    `;
    expect(referencesIn(source)).toEqual([]);
  });

  test("omits an attribute whose value is a JSX expression", () => {
    expect(referencesIn("<img src={image} />\n")).toEqual([]);
  });

  test("returns references in document order", () => {
    const source = `
      ![First image](./image-1.png)

      ![Second image](./image-2.png)
    `;
    expect(referencesIn(source)).toEqual(["./image-1.png", "./image-2.png"]);
  });
});
