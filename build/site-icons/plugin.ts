import { generatedFilesPlugin } from "../generated-file-middleware.ts";
import { ICON_ARTWORK_FILE_PATH, STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";
import { sharedLoad } from "../shared-load.ts";
import { readPalette } from "../stylesheet/palette.ts";

import { readArtwork } from "./artwork.ts";
import { iconFilesFrom } from "./icon-files.ts";
import { WEB_APP_MANIFEST_FILE_NAME, WEB_APP_MANIFEST_MEDIA_TYPE, webAppManifestFrom } from "./manifest.ts";

import type { Plugin } from "vite";

const SITE_ASSET_FILE_NAMES = [
  "favicon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "logo192.png",
  "logo512.png",
  "logo-maskable-512.png",
  WEB_APP_MANIFEST_FILE_NAME,
];

/** The files the plugin generates every icon and the web app manifest from. */
const INPUT_FILE_ABSOLUTE_PATHS = [fromRoot(ICON_ARTWORK_FILE_PATH), fromRoot(STYLESHEET_FILE_PATH)];

interface GeneratedFile {
  fileName: string;
  mediaType: string;
  contents: Buffer | string;
}

async function generateFiles(): Promise<Array<GeneratedFile>> {
  const palette = await readPalette();
  const icons = await iconFilesFrom(palette, await readArtwork());
  const files = [
    ...icons,
    {
      fileName: WEB_APP_MANIFEST_FILE_NAME,
      mediaType: WEB_APP_MANIFEST_MEDIA_TYPE,
      contents: `${JSON.stringify(webAppManifestFrom(palette, icons), null, 2)}\n`,
    },
  ];
  const generatedFileNames = files.map(({ fileName }) => fileName);
  const mismatchedFileNames = [
    ...generatedFileNames.filter((fileName) => !SITE_ASSET_FILE_NAMES.includes(fileName)),
    ...SITE_ASSET_FILE_NAMES.filter((fileName) => !generatedFileNames.includes(fileName)),
  ];

  if (mismatchedFileNames.length > 0) {
    throw new Error(
      `Generated site asset files do not match the files served by the dev server: ${mismatchedFileNames.join(", ")}.`,
    );
  }

  return files;
}

/** Generates the site's icons and web app manifest. */
export function siteIconsPlugin(): Plugin {
  const generatedFiles = sharedLoad(generateFiles);

  return {
    ...generatedFilesPlugin({
      name: "kuzmano.ski:site-icons",
      fileNames: SITE_ASSET_FILE_NAMES,
      load: async (fileName) => {
        const generatedFile = (await generatedFiles.get()).find((candidate) => candidate.fileName === fileName)!; // `generateFiles` checks that it generates every name in `SITE_ASSET_FILE_NAMES`.
        return { contentType: generatedFile.mediaType, contents: generatedFile.contents };
      },
    }),
    // Under `vite dev`, an edit to an input clears the generated files, so the next icon request generates them from
    // the edited input.
    watchChange(id) {
      if (INPUT_FILE_ABSOLUTE_PATHS.includes(id)) {
        generatedFiles.clear();
      }
    },
  };
}
