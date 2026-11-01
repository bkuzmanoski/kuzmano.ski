import { jsonValueModulePlugin } from "../json-value-module.ts";
import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { readPalette } from "./palette.ts";

import type { Palette } from "./palette.ts";
import type { Plugin } from "vite";

export const themeColorsFrom = ({ desktopBackground, startupSequenceBackdrop }: Palette) => ({
  desktopBackground,
  startupSequenceBackdrop,
});

export type ThemeColors = ReturnType<typeof themeColorsFrom>;

/** Exposes the palette's theme colors through `virtual:theme-colors`. */
export const themeColorsPlugin = (): Plugin =>
  jsonValueModulePlugin({
    name: "kuzmano.ski:theme-colors",
    moduleId: "virtual:theme-colors",
    exportName: "THEME_COLORS",
    load: async () => themeColorsFrom(await readPalette()),
    watchFiles: [fromRoot(STYLESHEET_FILE_PATH)],
  });
