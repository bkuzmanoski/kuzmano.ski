// The icons in `/public/` are generated binaries. `npm run generate:icons` records
// the inputs it used and the build compares that record against the current values.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { readPalette } from "../palette.ts";
import { ICON_ARTWORK, ICON_LOCK, fromRoot } from "../paths.ts";

/** The share of each icon's width the monogram fills. */
export const FILLS = { favicon: 0.9, appIcon: 0.8, maskable: 0.6 };

interface IconPalette {
  foregroundLight: string;
  foregroundDark: string;
  backgroundLight: string;
}

export interface IconInputs {
  artwork: string; // SHA-256 of the source SVG, hex encoded.
  fills: typeof FILLS;
  palette: IconPalette;
}

interface IconLock extends IconInputs {
  outputs: Array<string>; // File names, relative to `/public/`.
}

const hash = (contents: Buffer) => createHash("sha256").update(contents).digest("hex");

export async function readIconInputs(): Promise<IconInputs> {
  const { foregroundLight, foregroundDark, backgroundLight } = await readPalette();
  return {
    artwork: hash(await readFile(fromRoot(ICON_ARTWORK))),
    fills: FILLS,
    palette: { foregroundLight, foregroundDark, backgroundLight },
  };
}

export async function writeIconLock(outputs: Array<string>): Promise<void> {
  const lock: IconLock = { ...(await readIconInputs()), outputs };
  await writeFile(fromRoot(ICON_LOCK), `${JSON.stringify(lock, null, 2)}\n`);
}
