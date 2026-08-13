/**
 * Regenerates the favicon and app icons in `public/` from the site logo.
 * Icon colors are read from `src/styles.css`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { clamp } from "#/lib/math.ts"; // Extension required as this runs under Node's type stripping, not Vite.

const ROOT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLESHEET = join(ROOT_DIRECTORY, "src/styles.css");
const ARTWORK = join(ROOT_DIRECTORY, "src/assets/images/logo.svg");
const OUTPUT_DIRECTORY = join(ROOT_DIRECTORY, "public");

const FAVICON_FILL = 0.9;
const APP_ICON_FILL = 0.8;
const MASKABLE_FILL = 0.6;

const ICO_SIZES = [16, 32, 48];

const MAX_CHROMA = 0.4; // CSS Color 4 defines 100% chroma in `oklch()` as 0.4.

type Rgb = readonly [number, number, number]; // Channels in 0-255.
type Oklch = readonly [number, number, number]; // Lightness 0-1, chroma, hue in degrees.
type Scheme = "light" | "dark";

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch([r, g, b]: Rgb): Oklch {
  const red = srgbToLinear(r / 255);
  const green = srgbToLinear(g / 255);
  const blue = srgbToLinear(b / 255);

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return [lightness, Math.hypot(a, bAxis), ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360];
}

function oklchToRgb([lightness, chroma, hue]: Oklch): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const encode = (channel: number) => Math.round(clamp(linearToSrgb(channel), 0, 1) * 255);

  return [encode(red), encode(green), encode(blue)];
}

const toHex = (rgb: Rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

function parseHex(value: string): Rgb {
  const digits = value.slice(1);
  const expandedValue =
    digits.length === 3 || digits.length === 4 ? [...digits].map((digit) => digit + digit).join("") : digits;

  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(expandedValue)) {
    throw new Error(`Cannot read \`${value}\` as a hex color.`);
  }

  return [
    Number.parseInt(expandedValue.slice(0, 2), 16),
    Number.parseInt(expandedValue.slice(2, 4), 16),
    Number.parseInt(expandedValue.slice(4, 6), 16),
  ];
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/* Splits on separators that sit outside any parentheses, dropping empties. */
function splitTopLevel(input: string, isSeparator: (character: string) => boolean): Array<string> {
  const parts: Array<string> = [];

  let depth = 0;
  let current = "";

  for (const character of input) {
    if (character === "(") {
      depth += 1;
    }

    if (character === ")") {
      depth -= 1;
    }

    if (depth === 0 && isSeparator(character)) {
      if (current.trim()) {
        parts.push(current.trim());
      }

      current = "";

      continue;
    }

    current += character;
  }

  if (current.trim()) parts.push(current.trim());

  return parts;
}

const splitArguments = (input: string) => splitTopLevel(input, (character) => character === ",");
const splitWords = (input: string) => splitTopLevel(input, (character) => /\s/.test(character));

/** Index of the bracket closing the one at `openIndex`, or undefined if it never closes. */
function findMatching(input: string, openIndex: number, open: string, close: string): number | undefined {
  let depth = 0;

  for (let index = openIndex; index < input.length; index += 1) {
    const character = input[index];

    if (character === open) {
      depth += 1;
    }

    if (character === close) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function extractRootBlock(css: string): string {
  const selector = css.indexOf(":root");
  const openBraceIndex = selector === -1 ? -1 : css.indexOf("{", selector);

  if (openBraceIndex === -1) {
    throw new Error(`No \`:root\` block found in ${STYLESHEET}.`);
  }

  const closeBraceIndex = findMatching(css, openBraceIndex, "{", "}");

  if (closeBraceIndex === undefined) {
    throw new Error(`Unterminated \`:root\` block in ${STYLESHEET}.`);
  }

  return css.slice(openBraceIndex + 1, closeBraceIndex);
}

function parseCustomProperties(block: string): Map<string, string> {
  const properties = new Map<string, string>();

  for (const declaration of splitTopLevel(block, (character) => character === ";")) {
    const colonIndex = declaration.indexOf(":");

    if (colonIndex === -1) {
      continue;
    }

    const declarationName = declaration.slice(0, colonIndex).trim();

    if (declarationName.startsWith("--")) {
      properties.set(declarationName, declaration.slice(colonIndex + 1).trim());
    }
  }

  return properties;
}

/** Reads `name(args)`, rejecting values like `var(--a) var(--b)`. */
function parseFunction(value: string): { name: string; args: string } | undefined {
  const openParenthesisIndex = value.indexOf("(");
  const functionName = openParenthesisIndex === -1 ? "" : value.slice(0, openParenthesisIndex);

  // A single call closes on the last character. `var(--a) var(--b)` closes early.
  if (!/^[a-z-]+$/i.test(functionName) || findMatching(value, openParenthesisIndex, "(", ")") !== value.length - 1) {
    return undefined;
  }

  return { name: functionName.toLowerCase(), args: value.slice(openParenthesisIndex + 1, -1) };
}

function resolveVar(
  args: string,
  properties: Map<string, string>,
  trail: Array<string>,
): { name: string; value: string } {
  const [name, ...fallback] = splitArguments(args);

  if (name === undefined) {
    throw new Error("Found a `var()` with no custom property name.");
  }

  if (trail.includes(name)) {
    throw new Error(`Custom properties reference each other in a cycle: ${[...trail, name].join(" → ")}.`);
  }

  const declaredValue = properties.get(name);

  if (declaredValue !== undefined) {
    return { name, value: declaredValue };
  }

  const fallbackValue = fallback.join(", ");

  if (fallbackValue) {
    return { name, value: fallbackValue };
  }

  throw new Error(`Custom property \`${name}\` is not declared in \`:root\`.`);
}

function resolveComponent(
  token: string,
  channel: "l" | "c" | "h",
  origin: Oklch | undefined,
  properties: Map<string, string>,
  trail: Array<string>,
): number {
  let rawValue = token.trim();
  let scope = trail;

  for (;;) {
    const call = parseFunction(rawValue);

    if (call?.name !== "var") {
      break;
    }

    const resolved = resolveVar(call.args, properties, scope);

    rawValue = resolved.value.trim();
    scope = [...scope, resolved.name];
  }

  const keyword = rawValue.toLowerCase();

  if (keyword === "l" || keyword === "c" || keyword === "h") {
    if (!origin) {
      throw new Error(`\`${keyword}\` is only meaningful inside \`oklch(from …)\`.`);
    }

    if (keyword === "l") {
      return origin[0];
    }

    if (keyword === "c") {
      return origin[1];
    }

    return origin[2];
  }

  if (keyword === "none") return 0;

  if (rawValue.endsWith("%")) {
    const percentage = Number(rawValue.slice(0, -1));

    if (Number.isNaN(percentage)) {
      throw new Error(`Cannot read \`${token}\` as a percentage.`);
    }

    if (channel === "h") {
      throw new Error("Percentages are not valid for the hue component.");
    }

    return channel === "l" ? percentage / 100 : (percentage / 100) * MAX_CHROMA;
  }

  const numericValue = Number(rawValue.replace(/deg$/i, ""));

  if (Number.isNaN(numericValue)) {
    throw new Error(`Cannot read \`${token}\` as an \`oklch()\` component.`);
  }

  return numericValue;
}

function resolveColor(value: string, properties: Map<string, string>, scheme: Scheme, trail: Array<string> = []): Rgb {
  const input = value.trim();

  if (input.startsWith("#")) {
    return parseHex(input);
  }

  const call = parseFunction(input);

  if (call?.name === "var") {
    const resolved = resolveVar(call.args, properties, trail);
    return resolveColor(resolved.value, properties, scheme, [...trail, resolved.name]);
  }

  if (call?.name === "light-dark") {
    const arms = splitArguments(call.args);
    const arm = scheme === "light" ? arms[0] : arms[1];

    if (arm === undefined) {
      throw new Error(`\`light-dark()\` needs two arguments: \`${input}\`.`);
    }

    return resolveColor(arm, properties, scheme, trail);
  }

  if (call?.name === "oklch") {
    if (call.args.includes("/")) {
      throw new Error(`Alpha in \`oklch()\` is not supported: \`${input}\`.`);
    }

    const words = splitWords(call.args);
    const hasOrigin = words[0] === "from";

    let origin: Oklch | undefined;

    if (hasOrigin) {
      const originToken = words[1];

      if (originToken === undefined) {
        throw new Error(`\`oklch(from …)\` is missing its origin color: \`${input}\`.`);
      }

      origin = rgbToOklch(resolveColor(originToken, properties, scheme, trail));
    }

    const [lightness, chroma, hue] = hasOrigin ? words.slice(2) : words;

    if (lightness === undefined || chroma === undefined || hue === undefined) {
      throw new Error(`\`oklch()\` needs three components: \`${input}\`.`);
    }

    return oklchToRgb([
      resolveComponent(lightness, "l", origin, properties, trail),
      resolveComponent(chroma, "c", origin, properties, trail),
      resolveComponent(hue, "h", origin, properties, trail),
    ]);
  }

  throw new Error(
    `Cannot resolve \`${value}\` to a color. Supported forms are hex literals, \`var()\`, \`light-dark()\` and \`oklch()\`.`,
  );
}

interface Palette {
  foregroundLight: string;
  foregroundDark: string;
  backgroundLight: string;
  backgroundDark: string;
}

async function readPalette(): Promise<Palette> {
  const css = stripComments(await readFile(STYLESHEET, "utf8"));
  const properties = parseCustomProperties(extractRootBlock(css));

  const read = (name: string, scheme: Scheme) => {
    const declared = properties.get(name);

    if (declared === undefined) {
      throw new Error(`Custom property \`${name}\` is not declared in \`:root\`.`);
    }

    return toHex(resolveColor(declared, properties, scheme, [name]));
  };

  return {
    foregroundLight: read("--color-foreground", "light"),
    foregroundDark: read("--color-foreground", "dark"),
    backgroundLight: read("--color-background", "light"),
    backgroundDark: read("--color-background", "dark"),
  };
}

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

  /* The first path is the monogram. The second is the animation-only overlay
   * that the menu bar and boot sequence fade in, and carries `opacity="0"`. */
  const path = /<path\b[^>]*\bd="([^"]+)"/.exec(svg)?.[1];

  if (path === undefined) {
    throw new Error(`Could not find a path in ${ARTWORK}.`);
  }

  return { width, height, path };
}

/** A square canvas centred on the artwork, with the artwork filling `fill` of its width. */
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

/* The same palette is spelled out by hand in the manifest and in the document
 * shell's `theme-color` pair, neither of which this script owns. Flag it when
 * they fall out of step rather than leaving the mismatch to be noticed in a tab. */
async function reportDrift(palette: Palette) {
  const expectations = [
    { file: "public/manifest.json", colors: [palette.backgroundLight] },
    { file: "src/views/root-document.tsx", colors: [palette.backgroundLight, palette.backgroundDark] },
  ];

  for (const { file, colors } of expectations) {
    const contents = (await readFile(join(ROOT_DIRECTORY, file), "utf8")).toLowerCase();
    const missing = colors.filter((color) => !contents.includes(color.toLowerCase()));

    if (missing.length) {
      console.warn(`Warning: ${file} does not mention ${missing.join(" or ")}.`);
    }
  }
}

async function main() {
  const palette = await readPalette();
  const artwork = await readArtwork();
  const written: Array<string> = [];

  const write = async (name: string, contents: Buffer | string) => {
    await writeFile(join(OUTPUT_DIRECTORY, name), contents);
    written.push(name);
  };

  const { viewBox } = canvas(artwork, FAVICON_FILL);
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

  const glyph = buildSvg(artwork, FAVICON_FILL, { color: palette.foregroundLight });
  const appIcon = buildSvg(artwork, APP_ICON_FILL, {
    color: palette.foregroundLight,
    background: palette.backgroundLight,
  });
  const maskableIcon = buildSvg(artwork, MASKABLE_FILL, {
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

  console.log(`Palette resolved from ${STYLESHEET.replace(`${ROOT_DIRECTORY}/`, "")}:`);
  console.log(`  foreground  ${palette.foregroundLight} / ${palette.foregroundDark}`);
  console.log(`  background  ${palette.backgroundLight} / ${palette.backgroundDark}`);
  console.log(`Wrote ${written.length} files to public/: ${written.join(", ")}`);

  await reportDrift(palette);
}

await main();
