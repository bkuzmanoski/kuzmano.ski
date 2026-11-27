// Imports only types because `/vite.config.ts` loads this module.

import type { Plugin, Rollup } from "vite";

// Maps browserslist names to esbuild `build.cssTarget` names (Android Chrome/Firefox fall back to desktop targets).
const ESBUILD_BROWSER_NAMES: Readonly<Record<string, string>> = {
  chrome: "chrome",
  edge: "edge",
  firefox: "firefox",
  safari: "safari",
  ios_saf: "ios",
};

const LIGHTNINGCSS_LOWERING_PROPERTY = /--lightningcss-[\w-]+/; // Custom property emitted when Lightning CSS lowers a feature.

const NUMERIC_VERSION = /^\d+(\.\d+)?$/; // Excludes non-numeric versions like `TP` (Safari Technology Preview).

// Compares numeric browserslist versions (e.g., `17.5` vs `18`).
function compareVersions(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

/**
 * Converts browserslist entries into `build.cssTarget` values, using the lowest version for each browser esbuild
 * supports (e.g., `"ios_saf 17.5"` becomes `"ios17.5"`). Version ranges use their start (e.g., `18.5-18.7` becomes
 * `18.5`).
 *
 * Vite's Lightning CSS minifier uses `build.cssTarget` rather than browserslist. Its default targets older browsers,
 * causing it to lower `light-dark()` into custom properties resolved on `:root`. This makes a probe with its own
 * `color-scheme` (`computedColorOf`) read the document's scheme instead.
 */
export function cssTargetFrom(browsers: ReadonlyArray<string>): Array<string> {
  const lowestVersions = new Map<string, string>();

  for (const browser of browsers) {
    const [browserName = "", versionRange = ""] = browser.split(" ");
    const esbuildName = ESBUILD_BROWSER_NAMES[browserName];
    const version = versionRange.split("-")[0] ?? "";

    if (esbuildName === undefined || !NUMERIC_VERSION.test(version)) {
      continue;
    }

    const lowestVersion = lowestVersions.get(esbuildName);

    if (lowestVersion === undefined || compareVersions(version, lowestVersion) < 0) {
      lowestVersions.set(esbuildName, version);
    }
  }

  return [...lowestVersions].map(([esbuildName, version]) => `${esbuildName}${version}`);
}

export interface EmittedStylesheet {
  fileName: string;
  source: string;
}

/** Returns the names of the stylesheets that declare a custom property Lightning CSS adds to lower a feature. */
export const loweredStylesheetFileNamesIn = (stylesheets: ReadonlyArray<EmittedStylesheet>): Array<string> =>
  stylesheets.filter(({ source }) => LIGHTNINGCSS_LOWERING_PROPERTY.test(source)).map(({ fileName }) => fileName);

const emittedStylesheetsIn = (bundle: Rollup.OutputBundle): Array<EmittedStylesheet> =>
  Object.values(bundle).flatMap((output) =>
    output.type === "asset" && output.fileName.endsWith(".css")
      ? [
          {
            fileName: output.fileName,
            source: typeof output.source === "string" ? output.source : new TextDecoder().decode(output.source),
          },
        ]
      : [],
  );

/**
 * Fails the build if an emitted stylesheet contains `--lightningcss-*` properties added by the minifier when lowering a
 * feature. This can happen if `build.cssTarget` targets older browsers than `cssTargetFrom` specifies (e.g., after a
 * Vite upgrade changes how the target is read).
 */
export function cssTargetPlugin(): Plugin {
  return {
    name: "kuzmano.ski:css-target",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const loweredStylesheetFileNames = loweredStylesheetFileNamesIn(emittedStylesheetsIn(bundle));

      if (loweredStylesheetFileNames.length > 0) {
        this.error(
          `Lightning CSS lowered a feature with \`--lightningcss-*\` custom properties in ${loweredStylesheetFileNames.join(", ")}. Expected \`build.cssTarget\` from \`cssTargetFrom\`.`,
        );
      }
    },
  };
}
