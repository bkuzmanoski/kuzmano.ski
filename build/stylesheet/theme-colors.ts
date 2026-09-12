import { readPalette } from "./palette.ts";
import { stylesheetValuePlugin } from "./stylesheet-value.ts";

import type { Palette } from "./palette.ts";
import type { Plugin } from "vite";

export const themeColorsFrom = ({ wallpaper, bootSequenceBackdrop }: Palette) => ({
  wallpaper,
  bootSequenceBackdrop,
});

export type ThemeColors = ReturnType<typeof themeColorsFrom>;

export const themeColorsPlugin = (): Plugin =>
  stylesheetValuePlugin({
    name: "kuzmano.ski:theme-colors",
    moduleId: "virtual:theme-colors",
    exportName: "THEME_COLORS",
    read: async () => themeColorsFrom(await readPalette()),
  });
