import { readFile } from "node:fs/promises";

import valueParser from "postcss-value-parser";

import { THEME_CHROMA_SCALE_PROPERTY, THEME_CHROMA_SCALE_RANGE, isSteppedValueIn } from "#/lib/settings/theme-tint.ts";
import type { SteppedRange, ThemeDefaults } from "#/lib/settings/theme-tint.ts";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { rootCustomPropertiesIn } from "./custom-properties.ts";
import { stylesheetValuePlugin } from "./stylesheet-value.ts";

import type { Plugin } from "vite";

/** Reads a number declared in `:root`, throwing, naming the property, unless it is a whole number of steps within `range`. */
function steppedNumberOf(properties: Map<string, string>, property: string, range: SteppedRange) {
  const declaredValue = properties.get(property)?.trim();

  if (declaredValue === undefined) {
    throw new Error(`\`${property}\` is not declared in \`:root\`.`);
  }

  const parsedValue = valueParser.unit(declaredValue);
  const value = parsedValue && parsedValue.unit === "" ? Number(parsedValue.number) : Number.NaN;

  if (!isSteppedValueIn(value, range)) {
    throw new Error(
      `\`${property}\` is \`${declaredValue}\`. Expected a number from ${range.min} to ${range.max} in steps of ${range.step}.`,
    );
  }

  return value;
}

export function themeDefaultsFrom(css: string): ThemeDefaults {
  const properties = rootCustomPropertiesIn(css, STYLESHEET_FILE_PATH);
  return {
    chromaScale: steppedNumberOf(properties, THEME_CHROMA_SCALE_PROPERTY, THEME_CHROMA_SCALE_RANGE),
  };
}

export const readThemeDefaults = async (): Promise<ThemeDefaults> =>
  themeDefaultsFrom(await readFile(fromRoot(STYLESHEET_FILE_PATH), "utf8"));

/** Exposes the stylesheet's default theme chroma scale through `virtual:theme-defaults`. */
export const themeDefaultsPlugin = (): Plugin =>
  stylesheetValuePlugin({
    name: "kuzmano.ski:theme-defaults",
    moduleId: "virtual:theme-defaults",
    exportName: "THEME_DEFAULTS",
    load: readThemeDefaults,
  });
