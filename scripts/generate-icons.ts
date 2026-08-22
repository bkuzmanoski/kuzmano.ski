// Regenerates the favicon and app icons in `public/` from the site logo.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import { FILLS, writeIconLock } from "../build/icons/lock.ts";
import { readPalette } from "../build/palette.ts";
import { ICON_ARTWORK, ICON_LOCK, PUBLIC_DIRECTORY, STYLESHEET, fromRoot } from "../build/paths.ts";

const ARTWORK = fromRoot(ICON_ARTWORK);
const OUTPUT_DIRECTORY = fromRoot(PUBLIC_DIRECTORY);

const ICO_SIZES = [16, 32, 48];

interface Artwork {
  width: number;
  height: number;
  path: string;
}

async function readArtwork(): Promise<Artwork> {
  const svg = await readFile(ARTWORK, "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const bounds = viewBox?.trim().split(/\s+/).map(Number);
  const width = bounds?.[2];
  const height = bounds?.[3];

  if (width === undefined || height === undefined || Number.isNaN(width) || Number.isNaN(height)) {
    throw new Error(`Could not read a viewBox from ${ARTWORK}.`);
  }

  // The first path is the monogram. The second is the animation-only overlay
  // that the menu bar and boot sequence fade in, and carries `opacity="0"`.
  const path = /<path\b[^>]*\bd="([^"]+)"/.exec(svg)?.[1];

  if (path === undefined) {
    throw new Error(`Could not find a path in ${ARTWORK}.`);
  }

  return { width, height, path };
}

function canvas(artwork: Artwork, fill: number) {
  const size = artwork.width / fill;
  return {
    size,
    viewBox: `${(artwork.width - size) / 2} ${(artwork.height - size) / 2} ${size} ${size}`,
    origin: { x: (artwork.width - size) / 2, y: (artwork.height - size) / 2 },
  };
}

function buildSvg(artwork: Artwork, fill: number, { color, background }: { color: string; background?: string }) {
  const { size, viewBox, origin } = canvas(artwork, fill);
  const backdrop = background
    ? `<rect x="${origin.x}" y="${origin.y}" width="${size}" height="${size}" fill="${background}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${backdrop}<path fill="${color}" fill-rule="evenodd" clip-rule="evenodd" d="${artwork.path}"/></svg>`;
}

function encodeIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved.
  header.writeUInt16LE(1, 2); // 1 = icon.
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);

  let offset = header.length + directory.length;

  images.forEach(({ size, png }, index) => {
    const entry = 16 * index;
    directory.writeUInt8(size >= 256 ? 0 : size, entry); // 0 encodes 256.
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // Palette size; 0 for truecolor.
    directory.writeUInt8(0, entry + 3); // Reserved.
    directory.writeUInt16LE(1, entry + 4); // Color planes.
    directory.writeUInt16LE(32, entry + 6); // Bits per pixel.
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);

    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ png }) => png)]);
}

const rasterize = (markup: string, size: number) =>
  sharp(Buffer.from(markup), { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

async function main() {
  const palette = await readPalette();
  const artwork = await readArtwork();
  const written: Array<string> = [];

  const write = async (name: string, contents: Buffer | string) => {
    await writeFile(join(OUTPUT_DIRECTORY, name), contents);
    written.push(name);
  };

  const { viewBox } = canvas(artwork, FILLS.favicon);
  await write(
    "favicon.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <style>
    path {
      fill: ${palette.foregroundLight};
    }

    @media (prefers-color-scheme: dark) {
      path {
        fill: ${palette.foregroundDark};
      }
    }
  </style>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="${artwork.path}"
  />
</svg>`,
  );

  const glyph = buildSvg(artwork, FILLS.favicon, { color: palette.foregroundLight });
  const appIcon = buildSvg(artwork, FILLS.appIcon, {
    color: palette.foregroundLight,
    background: palette.backgroundLight,
  });
  const maskableIcon = buildSvg(artwork, FILLS.maskable, {
    color: palette.foregroundLight,
    background: palette.backgroundLight,
  });

  await write(
    "favicon.ico",
    encodeIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await rasterize(glyph, size) })))),
  );
  await write("apple-touch-icon.png", await rasterize(appIcon, 180));
  await write("logo192.png", await rasterize(appIcon, 192));
  await write("logo512.png", await rasterize(appIcon, 512));
  await write("logo-maskable-512.png", await rasterize(maskableIcon, 512));

  await writeIconLock(written);

  console.log(`Palette resolved from ${STYLESHEET}:`);
  console.log(`  foreground: ${palette.foregroundLight} / ${palette.foregroundDark}`);
  console.log(`  background: ${palette.backgroundLight} / ${palette.backgroundDark}`);
  console.log(`Wrote ${written.length} files to ${PUBLIC_DIRECTORY}/: ${written.join(", ")}`);
  console.log(`Recorded the inputs in ${ICON_LOCK}.`);
}

await main();
