// Resolves the site's foreground and background colors from `/src/styles.css`.

import { readFile } from "node:fs/promises";

import { clamp } from "#/lib/math.ts";

import { STYLESHEET, fromRoot } from "./paths.ts";

export interface Palette {
  foregroundLight: string;
  foregroundDark: string;
  backgroundLight: string;
  backgroundDark: string;
  wallpaperLight: string;
  wallpaperDark: string;
  bootSequenceBackdropLight: string;
  bootSequenceBackdropDark: string;
}

const MAX_CHROMA = 0.4; // CSS Color 4 defines 100% chroma in `oklch()` as 0.4.
const GAMUT_TOLERANCE = 1e-4; // Three orders of magnitude above in-gamut conversion error, two below the smallest out-of-gamut sRGB excursion.

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
  // CSS clamps these two components rather than reading them as out of range.
  const clampedLightness = clamp(lightness, 0, 1);
  const clampedChroma = Math.max(chroma, 0);

  const radians = (hue * Math.PI) / 180;
  const a = clampedChroma * Math.cos(radians);
  const b = clampedChroma * Math.sin(radians);

  const l = (clampedLightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (clampedLightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (clampedLightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  if ([red, green, blue].some((channel) => channel < -GAMUT_TOLERANCE || channel > 1 + GAMUT_TOLERANCE)) {
    const components = [clampedLightness, clampedChroma, hue].map((component) => Number(component.toFixed(4)));
    throw new Error(`\`oklch(${components.join(" ")})\` is outside sRGB. Reduce the chroma.`); // CSS Color 4 gamut mapping not implemented.
  }

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

/** A hex literal in the canonical form `readPalette` returns. Returns undefined for anything that is not a hex color. */
export function normalizeHex(value: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("#")) {
    return undefined;
  }

  try {
    return toHex(parseHex(trimmedValue));
  } catch {
    return undefined;
  }
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Splits on separators that sit outside any parentheses, dropping empties.
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

// Index of the bracket closing the one at `openIndex`, or undefined if it never closes.
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

// Reads `name(args)`, rejecting values like `var(--a) var(--b)`.
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

  if (!name) {
    throw new Error("Found a `var()` with no custom property name.");
  }

  if (trail.includes(name)) {
    throw new Error(`Custom properties reference each other in a cycle: ${[...trail, name].join(" → ")}.`);
  }

  const declaredValue = properties.get(name);

  // An empty declaration (`--x: ;`) resolves to nothing; treat it as undeclared instead of returning an unparsable value.
  if (declaredValue) {
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

    if (!arm) {
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

      if (!originToken) {
        throw new Error(`\`oklch(from …)\` is missing its origin color: \`${input}\`.`);
      }

      origin = rgbToOklch(resolveColor(originToken, properties, scheme, trail));
    }

    const [lightness, chroma, hue] = hasOrigin ? words.slice(2) : words;

    if (!lightness || !chroma || !hue) {
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

export function customPropertiesFrom(css: string): Map<string, string> {
  return parseCustomProperties(extractRootBlock(stripComments(css)));
}

/**
 * Resolves the palette from stylesheet source.
 *
 * Takes the CSS as a value so a color can be resolved without a stylesheet on disk.
 */
export function paletteFrom(css: string): Palette {
  const properties = customPropertiesFrom(css);

  const read = (name: string, scheme: Scheme) => {
    const declared = properties.get(name);

    if (!declared) {
      throw new Error(`Custom property \`${name}\` is not declared in \`:root\`.`);
    }

    return toHex(resolveColor(declared, properties, scheme, [name]));
  };

  return {
    foregroundLight: read("--color-foreground", "light"),
    foregroundDark: read("--color-foreground", "dark"),
    backgroundLight: read("--color-background", "light"),
    backgroundDark: read("--color-background", "dark"),
    wallpaperLight: read("--color-wallpaper", "light"),
    wallpaperDark: read("--color-wallpaper", "dark"),
    bootSequenceBackdropLight: read("--color-boot-sequence-backdrop", "light"),
    bootSequenceBackdropDark: read("--color-boot-sequence-backdrop", "dark"),
  };
}

export const readPalette = async (): Promise<Palette> => paletteFrom(await readFile(fromRoot(STYLESHEET), "utf8"));
