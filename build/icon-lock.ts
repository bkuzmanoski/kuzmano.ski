// The icons in `public/` are generated binaries. `npm run generate:icons` records
// the inputs it used and the build compares that record against the current values.

import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isRecord } from "#/lib/guards.ts";

import { readPalette } from "./palette.ts";
import { ICON_ARTWORK, ICON_LOCK, PUBLIC_DIRECTORY, ROOT_DIRECTORY, STYLESHEET } from "./paths.ts";

import type { Plugin } from "vite";

/** The share of each icon's width the monogram fills. */
export const FILLS = { favicon: 0.9, appIcon: 0.8, maskable: 0.6 };

/** The palette entries the icons are drawn with; the rest of the palette cannot stale them. */
export interface IconPalette {
  foregroundLight: string;
  foregroundDark: string;
  backgroundLight: string;
}

export interface IconInputs {
  artwork: string; // SHA-256 of the source SVG, hex encoded.
  fills: typeof FILLS;
  palette: IconPalette;
}

export interface IconLock extends IconInputs {
  outputs: Array<string>; // File names, relative to `public/`.
}

const hash = (contents: Buffer) => createHash("sha256").update(contents).digest("hex");

/** The inputs the generator would use right now. */
export async function readIconInputs(): Promise<IconInputs> {
  const { foregroundLight, foregroundDark, backgroundLight } = await readPalette();
  return {
    artwork: hash(await readFile(join(ROOT_DIRECTORY, ICON_ARTWORK))),
    fills: FILLS,
    palette: { foregroundLight, foregroundDark, backgroundLight },
  };
}

export async function writeIconLock(outputs: Array<string>): Promise<void> {
  const lock: IconLock = { ...(await readIconInputs()), outputs };
  await writeFile(join(ROOT_DIRECTORY, ICON_LOCK), `${JSON.stringify(lock, null, 2)}\n`);
}

/**
 * Compares a lock file's contents against the inputs the generator would use now.
 *
 * Takes the lock as a value so the drift messages can be exercised without a lock file on disk.
 */
export function findInputDrift(declared: unknown, current: IconInputs): Array<string> {
  if (!isRecord(declared)) {
    return [`${ICON_LOCK} is not an object`];
  }

  const drift: Array<string> = [];

  if (declared.artwork !== current.artwork) {
    drift.push(`the icons were generated from a different ${ICON_ARTWORK}`);
  }

  const declaredFills = isRecord(declared.fills) ? declared.fills : {};

  for (const [name, fill] of Object.entries(current.fills)) {
    if (declaredFills[name] !== fill) {
      drift.push(`the icons were generated with the ${name} fill at ${String(declaredFills[name])}, now ${fill}`);
    }
  }

  const declaredPalette = isRecord(declared.palette) ? declared.palette : {};

  for (const [name, color] of Object.entries(current.palette)) {
    if (declaredPalette[name] !== color) {
      drift.push(
        `the icons were generated with ${name} ${String(declaredPalette[name])}, ` +
          `which ${STYLESHEET} now resolves to ${color}`,
      );
    }
  }

  return drift;
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Every reason the icons in `public/` no longer match the palette and artwork they were generated from. */
export async function findIconDrift(): Promise<Array<string>> {
  let declared: unknown;

  try {
    declared = JSON.parse(await readFile(join(ROOT_DIRECTORY, ICON_LOCK), "utf8"));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return [`${ICON_LOCK} could not be read: ${reason}`];
  }

  const drift = findInputDrift(declared, await readIconInputs());
  const outputs = isRecord(declared) && Array.isArray(declared.outputs) ? declared.outputs : [];

  const missing = await Promise.all(
    outputs
      .filter((name): name is string => typeof name === "string")
      .map(async (name) => ((await exists(join(ROOT_DIRECTORY, PUBLIC_DIRECTORY, name))) ? null : name)),
  );

  return [...drift, ...missing.filter((name) => name !== null).map((name) => `${PUBLIC_DIRECTORY}/${name} is missing`)];
}

/** Fails the build when the generated icons no longer match the palette or the artwork behind them. */
export function iconDriftPlugin(): Plugin {
  return {
    name: "kuzmano.ski:icon-drift",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      this.addWatchFile(join(ROOT_DIRECTORY, STYLESHEET));
      this.addWatchFile(join(ROOT_DIRECTORY, ICON_ARTWORK));
      this.addWatchFile(join(ROOT_DIRECTORY, ICON_LOCK));

      let driftedInputs: Array<string>;

      try {
        driftedInputs = await findIconDrift();
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        return this.error(`Could not check the generated icons: ${reason}`);
      }

      if (driftedInputs.length > 0) {
        this.error(`Icon drift: ${driftedInputs.join("; ")}. Run \`npm run generate:icons\`.`);
      }
    },
  };
}
