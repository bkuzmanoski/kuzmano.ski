import sharp from "sharp";
import { expect, test } from "vitest";

import { readArtwork } from "./artwork.ts";
import { iconFilesFrom } from "./icon-files.ts";

import type { Artwork } from "./artwork.ts";
import type { IconFile } from "./icon-files.ts";
import type { Palette } from "../stylesheet/palette.ts";

// A black monogram on a white backdrop, so a decoded pixel is the monogram, the backdrop, or the
// antialiasing between them. The dark foreground differs from both, so `favicon.svg` cannot satisfy
// its scheme assertions by declaring one fill twice.
const palette: Palette = {
  foreground: { light: "#000000", dark: "#e5e5e5" },
  background: { light: "#ffffff", dark: "#111111" },
  wallpaper: { light: "#dddddd", dark: "#101010" },
  bootSequenceBackdrop: { light: "#333333", dark: "#444444" },
};

const artwork: Artwork = { width: 100, height: 100, path: "M0 0h100v100H0z" };

// The share of a maskable icon's width that a platform mask is guaranteed to leave visible is a
// circle of 80% of its width, so the monogram has to stay within 40% of the center.
// See https://www.w3.org/TR/appmanifest/#icon-masks.
const MASKABLE_SAFE_RADIUS = 0.4;

const MID_CHANNEL = 128; // A pixel darker than this is the monogram or its antialiasing, given the palette above.

const files = await iconFilesFrom(palette, artwork);

function fileNamed(icons: Array<IconFile>, fileName: string): IconFile {
  const file = icons.find((candidate) => candidate.fileName === fileName);

  if (!file) {
    throw new Error(`No icon file is named ${fileName}.`);
  }

  return file;
}

function rasterContentsIn(icons: Array<IconFile>, fileName: string): Buffer {
  const { contents } = fileNamed(icons, fileName);

  if (typeof contents === "string") {
    throw new Error(`${fileName} was generated as markup rather than as a raster image.`);
  }

  return contents;
}

// The distance from the center of an icon to its furthest monogram pixel, as a share of its width.
async function monogramRadiusIn(contents: Buffer): Promise<number> {
  const { data, info } = await sharp(contents).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let radius = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const red = data[(y * width + x) * channels];

      if (red !== undefined && red < MID_CHANNEL) {
        radius = Math.max(radius, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2));
      }
    }
  }

  return radius / width;
}

test("the six icon files are produced with their file names and media types", () => {
  expect(files.map(({ fileName, mediaType }) => ({ fileName, mediaType }))).toEqual([
    { fileName: "favicon.svg", mediaType: "image/svg+xml" },
    { fileName: "favicon.ico", mediaType: "image/x-icon" },
    { fileName: "apple-touch-icon.png", mediaType: "image/png" },
    { fileName: "logo192.png", mediaType: "image/png" },
    { fileName: "logo512.png", mediaType: "image/png" },
    { fileName: "logo-maskable-512.png", mediaType: "image/png" },
  ]);
});

test("each icon file records its web app manifest metadata, or `null` for `apple-touch-icon.png`", () => {
  expect(files.map(({ fileName, manifestIcon }) => [fileName, manifestIcon])).toEqual([
    ["favicon.svg", { sizes: "any" }],
    ["favicon.ico", { sizes: "48x48 32x32 16x16" }],
    ["apple-touch-icon.png", null],
    ["logo192.png", { sizes: "192x192", purpose: "any" }],
    ["logo512.png", { sizes: "512x512", purpose: "any" }],
    ["logo-maskable-512.png", { sizes: "512x512", purpose: "maskable" }],
  ]);
});

test("`favicon.svg` fills the monogram with the palette's light foreground, and with its dark foreground under `prefers-color-scheme: dark`", () => {
  const [beforeQuery, insideQuery] = String(fileNamed(files, "favicon.svg").contents).split(
    "@media (prefers-color-scheme: dark)",
  );

  expect(beforeQuery).toContain(palette.foreground.light);
  expect(beforeQuery).not.toContain(palette.foreground.dark);
  expect(insideQuery).toContain(palette.foreground.dark);
});

test('the maskable icon draws the committed monogram inside the safe radius `purpose: "maskable"` requires', async () => {
  const committedIcons = await iconFilesFrom(palette, await readArtwork());
  const radius = await monogramRadiusIn(rasterContentsIn(committedIcons, "logo-maskable-512.png"));

  expect(radius).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS);
});
