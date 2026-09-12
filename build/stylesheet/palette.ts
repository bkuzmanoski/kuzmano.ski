import { readFile } from "node:fs/promises";

import postcssColorMixFunction from "@csstools/postcss-color-mix-function";
import postcssOklabFunction from "@csstools/postcss-oklab-function";
import postcssRelativeColorSyntax from "@csstools/postcss-relative-color-syntax";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { rootCustomPropertiesIn } from "./custom-properties.ts";

import type { FunctionNode, Node } from "postcss-value-parser";

type Scheme = "light" | "dark";

export type SchemeColor = Record<Scheme, string>;

export interface Palette {
  foreground: SchemeColor;
  background: SchemeColor;
  wallpaper: SchemeColor;
  bootSequenceBackdrop: SchemeColor;
}

const COLOR_PLUGINS = [
  postcssRelativeColorSyntax({ preserve: false }),
  postcssOklabFunction({ preserve: false, subFeatures: { displayP3: false } }),
  postcssColorMixFunction({ preserve: false, subFeatures: { displayP3: false } }),
];

const HEX_VALUE = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const CHANNEL_MAXIMUM = 255;

/** The comma-separated argument lists of a function node. */
function argumentsOf(node: FunctionNode): Array<Array<Node>> {
  const argumentLists: Array<Array<Node>> = [[]];

  for (const child of node.nodes) {
    if (child.type === "div" && child.value === ",") {
      argumentLists.push([]);
      continue;
    }

    argumentLists.at(-1)?.push(child);
  }

  return argumentLists;
}

const isSignificant = (node: Node) => node.type !== "comment" && node.type !== "space";

function resolveVar(node: FunctionNode, properties: Map<string, string>, scheme: Scheme, trail: Array<string>): string {
  const [firstArgument, ...fallback] = argumentsOf(node);
  const nameNode = firstArgument?.find(isSignificant);

  if (nameNode?.type !== "word") {
    throw new Error("Found a `var()` with no custom property name.");
  }

  if (trail.includes(nameNode.value)) {
    throw new Error(`Custom properties reference each other in a cycle: ${[...trail, nameNode.value].join(" → ")}.`);
  }

  const declaredValue = properties.get(nameNode.value)?.trim();
  const nestedTrail = [...trail, nameNode.value];

  if (declaredValue) {
    return resolveIndirections(valueParser(declaredValue).nodes, properties, scheme, nestedTrail);
  }

  const fallbackNodes = valueParser(fallback.map((argument) => valueParser.stringify(argument)).join(",")).nodes;

  if (fallbackNodes.some(isSignificant)) {
    return resolveIndirections(fallbackNodes, properties, scheme, nestedTrail);
  }

  throw new Error(`Custom property \`${nameNode.value}\` is not declared in \`:root\`.`);
}

function resolveLightDark(
  node: FunctionNode,
  properties: Map<string, string>,
  scheme: Scheme,
  trail: Array<string>,
): string {
  const argumentLists = argumentsOf(node);
  const schemeArgument = scheme === "light" ? argumentLists[0] : argumentLists[1];

  if (!schemeArgument?.some(isSignificant)) {
    throw new Error(`\`light-dark()\` needs two arguments: \`${valueParser.stringify(node)}\`.`);
  }

  return resolveIndirections(schemeArgument, properties, scheme, trail);
}

// Resolves CSS indirections while leaving color syntax for `COLOR_PLUGINS`.
function resolveIndirections(
  nodes: Array<Node>,
  properties: Map<string, string>,
  scheme: Scheme,
  trail: Array<string>,
): string {
  return nodes
    .map((node) => {
      if (node.type === "comment") {
        return "";
      }

      if (node.type !== "function") {
        return valueParser.stringify(node);
      }

      if (node.value === "var") {
        return resolveVar(node, properties, scheme, trail);
      }

      if (node.value === "light-dark") {
        return resolveLightDark(node, properties, scheme, trail);
      }

      return `${node.value}(${node.before}${resolveIndirections(node.nodes, properties, scheme, trail)}${node.after})`;
    })
    .join("");
}

async function computeColor(value: string): Promise<string> {
  const processedCss = await postcss(COLOR_PLUGINS).process(`a{color:${value}}`, { from: undefined });

  let computedValue = value;

  processedCss.root.walkDecls("color", (declaration) => {
    computedValue = declaration.value;
  });

  return computedValue;
}

function channelFrom(node: Node): number | null {
  if (node.type !== "word") {
    return null;
  }

  const parsedUnit = valueParser.unit(node.value);

  if (!parsedUnit || parsedUnit.number === "" || (parsedUnit.unit !== "" && parsedUnit.unit !== "%")) {
    return null;
  }

  const channelNumber = Number(parsedUnit.number);
  const channelValue = parsedUnit.unit === "%" ? (channelNumber * CHANNEL_MAXIMUM) / 100 : channelNumber;

  return Number.isNaN(channelValue) ? null : Math.min(CHANNEL_MAXIMUM, Math.max(0, Math.round(channelValue)));
}

function rgbChannelsIn(node: FunctionNode): Array<number> | null {
  const channels: Array<number> = [];

  for (const child of node.nodes) {
    if (child.type === "div" && child.value === "/") {
      break;
    }

    if (child.type === "div" || child.type === "space" || child.type === "comment") {
      continue;
    }

    const channel = channelFrom(child);

    if (channel === null) {
      return null;
    }

    channels.push(channel);

    if (channels.length === 3) {
      break;
    }
  }

  return channels.length === 3 ? channels : null;
}

function hexFrom(computed: string, authored: string): string {
  const hexDigits = HEX_VALUE.exec(computed.trim())?.[1];

  if (hexDigits) {
    const expandedDigits = hexDigits.length <= 4 ? [...hexDigits].map((digit) => digit + digit).join("") : hexDigits;
    return `#${expandedDigits.slice(0, 6).toLowerCase()}`;
  }

  const [firstNode, ...remainingNodes] = valueParser(computed).nodes.filter(isSignificant);
  const isRgb =
    firstNode?.type === "function" &&
    ["rgb", "rgba"].includes(firstNode.value.toLowerCase()) &&
    remainingNodes.length === 0;
  const channels = isRgb ? rgbChannelsIn(firstNode) : null;

  if (!channels) {
    throw new Error(`Cannot resolve \`${authored}\` to a color. It computed to \`${computed}\`.`);
  }

  const hexColor = `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

  if (!HEX_VALUE.test(hexColor)) {
    throw new Error(`Resolving \`${authored}\` produced \`${hexColor}\`, which is not a hex color.`);
  }

  return hexColor;
}

/** Resolves the palette from stylesheet source. */
export async function paletteFrom(css: string): Promise<Palette> {
  const properties = rootCustomPropertiesIn(css, STYLESHEET_FILE_PATH);

  const hexOf = async (name: string, scheme: Scheme) => {
    const declaredValue = properties.get(name)?.trim();

    if (!declaredValue) {
      throw new Error(`Custom property \`${name}\` is not declared in \`:root\`.`);
    }

    const authoredValue = resolveIndirections(valueParser(declaredValue).nodes, properties, scheme, [name]);

    return hexFrom(await computeColor(authoredValue), authoredValue);
  };
  const colorOf = async (name: string): Promise<SchemeColor> => ({
    light: await hexOf(name, "light"),
    dark: await hexOf(name, "dark"),
  });

  return {
    foreground: await colorOf("--color-foreground"),
    background: await colorOf("--color-background"),
    wallpaper: await colorOf("--color-wallpaper"),
    bootSequenceBackdrop: await colorOf("--color-boot-sequence-backdrop"),
  };
}

export const readPalette = async (): Promise<Palette> =>
  paletteFrom(await readFile(fromRoot(STYLESHEET_FILE_PATH), "utf8"));
