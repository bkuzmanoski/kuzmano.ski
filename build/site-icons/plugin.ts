import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { ICON_ARTWORK_FILE_PATH, STYLESHEET_FILE_PATH, fromRoot, requestPathOf } from "../paths.ts";
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
  let generatedFilesPromise: Promise<Array<GeneratedFile>> | null = null;

  const ensureFiles = () =>
    (generatedFilesPromise ??= generateFiles().catch((cause: unknown) => {
      generatedFilesPromise = null; // Clear failed generation so later requests can retry after the inputs are fixed.
      throw cause;
    }));

  return {
    name: "kuzmano.ski:site-icons",
    buildStart() {
      this.addWatchFile(fromRoot(ICON_ARTWORK_FILE_PATH));
      this.addWatchFile(fromRoot(STYLESHEET_FILE_PATH));
    },
    async generateBundle() {
      if (this.environment.name !== CLIENT_ENVIRONMENT) {
        return;
      }

      for (const { fileName, contents } of await ensureFiles()) {
        this.emitFile({ type: "asset", fileName, source: contents });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = requestPathOf(request);
        const fileName = SITE_ASSET_FILE_NAMES.find((candidate) => requestPath === `/${candidate}`);

        // Generate files only for icon requests so invalid artwork or stylesheets do not break unrelated dev-server requests.
        if (fileName === undefined) {
          next();
          return;
        }

        ensureFiles()
          .then((generatedFiles) => {
            const requestedFile = generatedFiles.find((candidate) => candidate.fileName === fileName);

            if (!requestedFile) {
              next();
              return;
            }

            response.setHeader("content-type", requestedFile.mediaType);
            response.end(requestedFile.contents);
          })
          .catch(next);
      });
    },
    hotUpdate({ file }) {
      if (file === fromRoot(ICON_ARTWORK_FILE_PATH) || file === fromRoot(STYLESHEET_FILE_PATH)) {
        generatedFilesPromise = null;
      }
    },
  };
}
