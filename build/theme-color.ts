import { readFile } from "node:fs/promises";

import { isRecord } from "#/lib/guards.ts";

import { normalizeHex, readPalette } from "./palette.ts";
import { STYLESHEET, fromRoot } from "./paths.ts";

import type { Palette } from "./palette.ts";
import type { Plugin } from "vite";

const MANIFEST = "public/manifest.json";
const DOCUMENT = "src/app/root-document.tsx";
const META_TAG = /<meta\b[^>]*\bname="theme-color"[^>]*?\/?>/g;
const MEDIA_QUERY = /\bmedia="\(prefers-color-scheme:\s*(light|dark)\)"/;
const CONTENT = /\bcontent="([^"]*)"/;

function compare(file: string, key: string, declared: string | undefined, expected: string): Array<string> {
  if (declared === undefined) {
    return [`${file} is missing ${key}`];
  }

  const normalizedValue = normalizeHex(declared);

  if (!normalizedValue) {
    return [`${file} ${key} is \`${declared}\`, which is not a hex color`];
  }

  return normalizedValue === expected ? [] : [`${file} ${key} is ${normalizedValue}, expected ${expected}`];
}

async function findManifestDrift(palette: Palette): Promise<Array<string>> {
  const manifest: unknown = JSON.parse(await readFile(fromRoot(MANIFEST), "utf8"));

  if (!isRecord(manifest)) {
    return [`${MANIFEST} is not an object`];
  }

  const expected = { theme_color: palette.wallpaperLight, background_color: palette.bootSequenceBackdropLight };

  return Object.entries(expected).flatMap(([key, color]) => {
    const declared = manifest[key];
    return compare(MANIFEST, `\`${key}\``, typeof declared === "string" ? declared : undefined, color);
  });
}

async function findDocumentDrift(palette: Palette): Promise<Array<string>> {
  const source = await readFile(fromRoot(DOCUMENT), "utf8");
  const expected = new Map([
    ["boot sequence backdrop light", palette.bootSequenceBackdropLight],
    ["boot sequence backdrop dark", palette.bootSequenceBackdropDark],
    ["light", palette.wallpaperLight],
    ["dark", palette.wallpaperDark],
  ]);
  const declared = new Map<string, string>();

  for (const [tag] of source.matchAll(META_TAG)) {
    const scheme = MEDIA_QUERY.exec(tag)?.[1];
    const content = CONTENT.exec(tag)?.[1];

    if (!scheme || !content) {
      return [`${DOCUMENT} has a \`theme-color\` without a \`prefers-color-scheme\` media query or a value`];
    }

    const key = tag.includes("data-boot-sequence-theme-color") ? `boot sequence backdrop ${scheme}` : scheme;

    if (declared.has(key)) {
      return [`${DOCUMENT} declares the ${key} \`theme-color\` more than once`];
    }

    declared.set(key, content);
  }

  return [
    ...[...expected].flatMap(([key, color]) =>
      compare(DOCUMENT, `the ${key} \`theme-color\``, declared.get(key), color),
    ),
    ...[...declared.keys()]
      .filter((key) => !expected.has(key))
      .map((key) => `${DOCUMENT} declares an unexpected ${key} \`theme-color\``),
  ];
}

/** Fails the build when a hand-written theme color differs from the definition in `/src/styles.css`. */
export function themeColorPlugin(): Plugin {
  return {
    name: "kuzmano.ski:theme-color",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      this.addWatchFile(fromRoot(STYLESHEET));

      let driftedValues: Array<string>;

      try {
        const palette = await readPalette();
        driftedValues = [...(await findManifestDrift(palette)), ...(await findDocumentDrift(palette))];
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
