import { expect, test } from "vitest";

import { readPalette } from "./palette.ts";
import { themeColorsFrom } from "./theme-colors.ts";

test("theme colors include the wallpaper and boot sequence backdrop for each scheme", async () => {
  const palette = await readPalette();
  expect(themeColorsFrom(palette)).toEqual({
    wallpaper: palette.wallpaper,
    bootSequenceBackdrop: palette.bootSequenceBackdrop,
  });
});

test("theme colors exclude the palette foreground and background", async () => {
  expect(Object.keys(themeColorsFrom(await readPalette()))).toEqual(["wallpaper", "bootSequenceBackdrop"]);
});
