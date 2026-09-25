import { readPalette } from "./palette.ts";
import { stylesheetValuePlugin } from "./stylesheet-value.ts";

import type { Palette } from "./palette.ts";
import type { Plugin } from "vite";

export const themeColorsFrom = ({ wallpaper, bootSequenceBackdrop }: Palette) => ({
  wallpaper,
  bootSequenceBackdrop,
});

export type ThemeColors = ReturnType<typeof themeColorsFrom>;

/** Exposes the palette's theme colors through `virtual:theme-colors`. */
export const themeColorsPlugin = (): Plugin =>
  stylesheetValuePlugin({
    name: "kuzmano.ski:theme-colors",
    moduleId: "virtual:theme-colors",
    exportName: "THEME_COLORS",
    load: async () => themeColorsFrom(await readPalette()),
  });
