import { expect, test } from "vitest";

import { artworkIn, readArtwork } from "./artwork.ts";

const MONOGRAM = '<path class="background" fill-rule="evenodd" d="M0 0h486v450z"/>';
const OVERLAY = '<path class="foreground" opacity="0" d="M9 9h1v1z"/>';

const svg = (children: string, viewBox = "0 0 486 450") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${children}</svg>`;

test("the monogram is read from the `.background` path, whichever order the artwork declares its paths in", () => {
  const monogram = { width: 486, height: 450, path: "M0 0h486v450z" };

  expect(artworkIn(svg(MONOGRAM + OVERLAY))).toEqual(monogram);
  expect(artworkIn(svg(OVERLAY + MONOGRAM))).toEqual(monogram);
});

test("throws when reading artwork with no `.background` path, naming the artwork", () => {
  expect(() => artworkIn(svg(OVERLAY))).toThrow(/logo\.svg has 0 .* elements/);
});

test("throws when reading artwork with a second `.background` path", () => {
  expect(() => artworkIn(svg(MONOGRAM + MONOGRAM))).toThrow(/has 2 .* elements/);
});

test("throws when reading artwork whose `.background` path has no path data", () => {
  expect(() => artworkIn(svg('<path class="background"/>'))).toThrow(/no path data/);
});

test("throws when reading artwork with no `<svg>` element", () => {
  expect(() => artworkIn(MONOGRAM)).toThrow(/no `<svg>` element/);
});

test("throws when reading artwork whose viewBox is not four numbers", () => {
  expect(() => artworkIn(svg(MONOGRAM, "0 0 486"))).toThrow(/viewBox/);
  expect(() => artworkIn(svg(MONOGRAM, "0 0 486 450 90"))).toThrow(/viewBox/);
  expect(() => artworkIn(svg(MONOGRAM, "0 0 486 wide"))).toThrow(/viewBox/);
});

test("throws when reading artwork whose viewBox has a width or height of zero or less", () => {
  expect(() => artworkIn(svg(MONOGRAM, "0 0 486 0"))).toThrow(/viewBox/);
  expect(() => artworkIn(svg(MONOGRAM, "0 0 0 450"))).toThrow(/viewBox/);
  expect(() => artworkIn(svg(MONOGRAM, "0 0 -486 -450"))).toThrow(/viewBox/);
  expect(() => artworkIn(svg(MONOGRAM, "0 0 486 -450"))).toThrow(/viewBox/);
});

test("the committed artwork resolves to a monogram filling its viewBox", async () => {
  const artwork = await readArtwork();

  expect(artwork.width).toBe(486);
  expect(artwork.height).toBe(450);
  expect(artwork.path).toMatch(/^M320 0c93 0 156 12 156 112/);
});
