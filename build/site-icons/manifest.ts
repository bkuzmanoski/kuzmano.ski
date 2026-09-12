import { SITE_NAME } from "#/config/site.ts";

import type { IconFile, ManifestIcon } from "./icon-files.ts";
import type { Palette } from "../stylesheet/palette.ts";

export const WEB_APP_MANIFEST_FILE_NAME = "manifest.json";
export const WEB_APP_MANIFEST_MEDIA_TYPE = "application/manifest+json";

interface WebAppManifestIcon extends ManifestIcon {
  src: string;
  type: string;
}

export interface WebAppManifest {
  id: string;
  short_name: string;
  name: string;
  icons: Array<WebAppManifestIcon>;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
}

export const webAppManifestFrom = (palette: Palette, icons: Array<IconFile>): WebAppManifest => ({
  id: "/",
  short_name: SITE_NAME,
  name: SITE_NAME,
  icons: icons.flatMap(({ fileName, mediaType, manifestIcon }) =>
    manifestIcon ? [{ src: fileName, type: mediaType, ...manifestIcon }] : [],
  ),
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: palette.wallpaper.light,
  background_color: palette.bootSequenceBackdrop.light,
});
