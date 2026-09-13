import sharp from "sharp";
import ico from "sharp-ico";

import type { Artwork } from "./artwork.ts";
import type { Palette } from "../stylesheet/palette.ts";

export interface ManifestIcon {
  sizes: string;
  purpose?: "any" | "maskable";
}

export interface IconFile {
  fileName: string;
  mediaType: string;
  manifestIcon: ManifestIcon | null; // `null` for a file the web app manifest does not list.
  contents: Buffer | string;
}

const MONOGRAM_FILLS = { favicon: 0.9, appIcon: 0.8, maskable: 0.6 }; // Fraction of each icon's width occupied by the monogram.
const SVG_MEDIA_TYPE = "image/svg+xml";
const ICO_MEDIA_TYPE = "image/x-icon";
const PNG_MEDIA_TYPE = "image/png";
const ICO_SIZES = [16, 32, 48];

const square = (size: number) => `${size}x${size}`;

function canvas({ width, height }: Artwork, fill: number) {
  const size = width / fill;
  const origin = { x: (width - size) / 2, y: (height - size) / 2 };

  return { size, origin, viewBox: `${origin.x} ${origin.y} ${size} ${size}` };
}

function monogramSvg(artwork: Artwork, fill: number, { color, background }: { color: string; background?: string }) {
  const { size, origin, viewBox } = canvas(artwork, fill);
  const backdrop = background
    ? `<rect x="${origin.x}" y="${origin.y}" width="${size}" height="${size}" fill="${background}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${backdrop}<path fill="${color}" fill-rule="evenodd" clip-rule="evenodd" d="${artwork.path}"/></svg>`;
}

const faviconSvg = (artwork: Artwork, palette: Palette) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${canvas(artwork, MONOGRAM_FILLS.favicon).viewBox}">
  <style>
    path {
      fill: ${palette.foreground.light};
    }

    @media (prefers-color-scheme: dark) {
      path {
        fill: ${palette.foreground.dark};
      }
    }
  </style>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="${artwork.path}"
  />
</svg>`;

// Render at high density so Sharp downsamples the SVG instead of upscaling its 96 DPI output.
//
// Indexed PNGs reduce the size of standalone flat-color icons. ICO frames use full color because
// `sharp-ico` cannot read indexed PNGs, and palette/transparency metadata outweighs the savings at
// 48px and below.
const rasterize = (markup: string, size: number, { indexed }: { indexed: boolean }) =>
  sharp(Buffer.from(markup), { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: indexed })
    .toBuffer();

export async function iconFilesFrom(palette: Palette, artwork: Artwork): Promise<Array<IconFile>> {
  const glyph = monogramSvg(artwork, MONOGRAM_FILLS.favicon, { color: palette.foreground.light });
  const appIcon = monogramSvg(artwork, MONOGRAM_FILLS.appIcon, {
    color: palette.foreground.light,
    background: palette.background.light,
  });
  const maskableIcon = monogramSvg(artwork, MONOGRAM_FILLS.maskable, {
    color: palette.foreground.light,
    background: palette.background.light,
  });

  const pngIcon = async ({
    fileName,
    drawing,
    size,
    purpose,
  }: {
    fileName: string;
    drawing: string;
    size: number;
    purpose: ManifestIcon["purpose"] | null;
  }): Promise<IconFile> => ({
    fileName,
    mediaType: PNG_MEDIA_TYPE,
    manifestIcon: purpose ? { sizes: square(size), purpose } : null,
    contents: await rasterize(drawing, size, { indexed: true }),
  });

  return [
    {
      fileName: "favicon.svg",
      mediaType: SVG_MEDIA_TYPE,
      manifestIcon: { sizes: "any" },
      contents: faviconSvg(artwork, palette),
    },
    {
      fileName: "favicon.ico",
      mediaType: ICO_MEDIA_TYPE,
      manifestIcon: { sizes: [...ICO_SIZES].reverse().map(square).join(" ") },
      contents: ico.encode(await Promise.all(ICO_SIZES.map((size) => rasterize(glyph, size, { indexed: false })))),
    },
    ...(await Promise.all([
      pngIcon({ fileName: "apple-touch-icon.png", drawing: appIcon, size: 180, purpose: null }),
      pngIcon({ fileName: "logo192.png", drawing: appIcon, size: 192, purpose: "any" }),
      pngIcon({ fileName: "logo512.png", drawing: appIcon, size: 512, purpose: "any" }),
      pngIcon({ fileName: "logo-maskable-512.png", drawing: maskableIcon, size: 512, purpose: "maskable" }),
    ])),
  ];
}
