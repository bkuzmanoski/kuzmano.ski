import { readFile } from "node:fs/promises";

import { LAYOUT } from "#/config/desktop.ts";

import { customPropertiesFrom } from "./palette.ts";
import { STYLESHEET, fromRoot } from "./paths.ts";

import type { Plugin } from "vite";

const CONFIG = "src/config/desktop.ts";
const MIRRORED_LENGTHS = [
  { property: "--window-layer-padding", expression: "LAYOUT.padding", pixels: LAYOUT.padding },
  {
    property: "--title-bar-height",
    expression: "LAYOUT.cascadeOffset.y - 1",
    pixels: LAYOUT.cascadeOffset.y - 1,
  },
];

const PIXEL_LENGTH = /^(-?\d+(?:\.\d+)?)px$/;

/**
 * Returns every difference between `LAYOUT` and the custom properties that mirror it.
 *
 * Takes the CSS as a value so drift can be checked without a stylesheet on disk.
 */
export function findLayoutDrift(css: string): Array<string> {
  const properties = customPropertiesFrom(css);
  return MIRRORED_LENGTHS.flatMap(({ property, expression, pixels }) => {
    const declared = properties.get(property);

    if (declared === undefined) {
      return [`${STYLESHEET} does not declare \`${property}\`, which mirrors \`${expression}\` (${pixels}px)`];
    }

    const length = PIXEL_LENGTH.exec(declared)?.[1];

    if (length === undefined) {
      return [`\`${property}\` is \`${declared}\` in ${STYLESHEET}, which is not a pixel length`];
    }

    return Number(length) === pixels
      ? []
      : [`\`${property}\` is ${declared} in ${STYLESHEET}, but \`${expression}\` in ${CONFIG} is ${pixels}px`];
  });
}

/** Returns every difference between `LAYOUT` and the stylesheet on disk. */
export const readLayoutDrift = async (): Promise<Array<string>> =>
  findLayoutDrift(await readFile(fromRoot(STYLESHEET), "utf8"));

/** Fails the build when a layout metric in CSS differs from the `LAYOUT` value it mirrors. */
export function layoutDriftPlugin(): Plugin {
  return {
    name: "kuzmano.ski:layout-drift",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      this.addWatchFile(fromRoot(STYLESHEET));
      this.addWatchFile(fromRoot(CONFIG));

      let driftedLengths: Array<string>;

      try {
        driftedLengths = await readLayoutDrift();
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        return this.error(`Could not read the layout metrics in ${STYLESHEET}: ${reason}`);
      }

      if (driftedLengths.length > 0) {
        this.error(`Layout drift: ${driftedLengths.join("; ")}.`);
      }
    },
  };
}
