import { access, readFile } from "node:fs/promises";

import { isRecord } from "#/lib/guards.ts";

import { ICON_ARTWORK, ICON_LOCK, PUBLIC_DIRECTORY, STYLESHEET, fromRoot } from "../paths.ts";

import { readIconInputs } from "./lock.ts";

import type { IconInputs } from "./lock.ts";
import type { Plugin } from "vite";

/**
 * Compares the declared lock inputs with the inputs currently used for generation.
 *
 * Takes the declared inputs as a value so drift can be checked without reading a lock file.
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

/** Returns every difference between the generated icons and their current inputs. */
export async function findIconDrift(): Promise<Array<string>> {
  let declared: unknown;

  try {
    declared = JSON.parse(await readFile(fromRoot(ICON_LOCK), "utf8"));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return [`${ICON_LOCK} could not be read: ${reason}`];
  }

  const drift = findInputDrift(declared, await readIconInputs());
  const outputs = isRecord(declared) && Array.isArray(declared.outputs) ? declared.outputs : [];

  const missing = await Promise.all(
    outputs
      .filter((name): name is string => typeof name === "string")
      .map(async (name) => ((await exists(fromRoot(`${PUBLIC_DIRECTORY}/${name}`))) ? null : name)),
  );

  return [...drift, ...missing.filter((name) => name !== null).map((name) => `${PUBLIC_DIRECTORY}/${name} is missing`)];
}

/** Fails the build when the generated icons no longer match their inputs. */
export function iconDriftPlugin(): Plugin {
  return {
    name: "kuzmano.ski:icon-drift",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      this.addWatchFile(fromRoot(STYLESHEET));
      this.addWatchFile(fromRoot(ICON_ARTWORK));
      this.addWatchFile(fromRoot(ICON_LOCK));

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
