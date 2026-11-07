import { expect, test, vi } from "vitest";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";
import { hookOf } from "../test-utils/plugin-hooks.ts";

import { readPalette } from "./palette.ts";
import { themeColorsFrom, themeColorsPlugin } from "./theme-colors.ts";

import type { LoadHook } from "../test-utils/plugin-hooks.ts";

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

test("the plugin records the stylesheet as a watched file of the virtual module", async () => {
  const context = { addWatchFile: vi.fn<(file: string) => void>() };

  await hookOf<LoadHook<typeof context>>(themeColorsPlugin(), "load").call(context, "\0virtual:theme-colors");

  expect(context.addWatchFile).toHaveBeenCalledWith(fromRoot(STYLESHEET_FILE_PATH));
});
