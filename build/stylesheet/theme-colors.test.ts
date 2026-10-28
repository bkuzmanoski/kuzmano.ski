import { expect, test } from "vitest";

import { readPalette } from "./palette.ts";
import { themeColorsFrom } from "./theme-colors.ts";

test("theme colors include the desktop background and startup sequence backdrop for each scheme", async () => {
  const palette = await readPalette();
  expect(themeColorsFrom(palette)).toEqual({
    desktopBackground: palette.desktopBackground,
    startupSequenceBackdrop: palette.startupSequenceBackdrop,
  });
});

test("theme colors exclude the palette foreground and background", async () => {
  expect(Object.keys(themeColorsFrom(await readPalette()))).toEqual(["desktopBackground", "startupSequenceBackdrop"]);
});
