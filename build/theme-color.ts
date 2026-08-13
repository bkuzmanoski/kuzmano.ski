import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { readPalette } from "./palette.ts";
import { ROOT_DIRECTORY, STYLESHEET } from "./paths.ts";

import type { Palette } from "./palette.ts";
import type { Plugin } from "vite";

async function findDrift(palette: Palette): Promise<Array<string>> {
  const dependents = [
    { file: "public/manifest.json", colors: [palette.backgroundLight] },
    { file: "src/views/root-document.tsx", colors: [palette.backgroundLight, palette.backgroundDark] },
  ];
  const drifted: Array<string> = [];

  for (const { file, colors } of dependents) {
    const contents = (await readFile(join(ROOT_DIRECTORY, file), "utf8")).toLowerCase();
    const missing = colors.filter((color) => !contents.includes(color.toLowerCase()));

    if (missing.length) {
      drifted.push(`${file} does not mention ${missing.join(" or ")}`);
    }
  }

  return drifted;
}

/** Fails the build when a hand-written theme color differs from the definition in `src/styles.css`. */
export function themeColorPlugin(): Plugin {
  return {
    name: "kuzmano.ski:theme-color",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      this.addWatchFile(STYLESHEET);

      let driftedValues: Array<string>;

      try {
        driftedValues = await findDrift(await readPalette());
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        return this.error(`Could not read the theme colors in ${STYLESHEET}: ${reason}`);
      }

      if (driftedValues.length > 0) {
        this.error(`Theme color drift: ${driftedValues.join("; ")}. `);
      }
    },
  };
}
