import { expect, test } from "vitest";

import { readArtwork } from "./artwork.ts";
import { iconFilesFrom } from "./icon-files.ts";
import { webAppManifestFrom } from "./manifest.ts";

import type { Palette } from "../stylesheet/palette.ts";

const palette: Palette = {
  foreground: { light: "#111111", dark: "#eeeeee" },
  background: { light: "#fefefe", dark: "#222222" },
  wallpaper: { light: "#dddddd", dark: "#101010" },
  bootSequenceBackdrop: { light: "#333333", dark: "#444444" },
};
const icons = await iconFilesFrom(palette, await readArtwork());
const manifest = webAppManifestFrom(palette, icons);

test("the theme and background colors are the palette's light wallpaper and boot sequence backdrop", () => {
  expect(manifest.theme_color).toBe(palette.wallpaper.light);
  expect(manifest.background_color).toBe(palette.bootSequenceBackdrop.light);
});

test("each generated icon represented by the manifest is listed with its file name, media type, sizes, and purpose", () => {
  expect(manifest.icons).toEqual([
    { src: "favicon.svg", type: "image/svg+xml", sizes: "any" },
    { src: "favicon.ico", type: "image/x-icon", sizes: "48x48 32x32 16x16" },
    { src: "logo192.png", type: "image/png", sizes: "192x192", purpose: "any" },
    { src: "logo512.png", type: "image/png", sizes: "512x512", purpose: "any" },
    { src: "logo-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
  ]);
});

test("apple-touch-icon.png is generated, and omitted from the icons array", () => {
  expect(icons.map(({ fileName }) => fileName)).toContain("apple-touch-icon.png");
  expect(manifest.icons.map(({ src }) => src)).not.toContain("apple-touch-icon.png");
});
