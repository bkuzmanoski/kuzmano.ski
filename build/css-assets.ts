// Vite emits a relative `url()` it cannot resolve as the literal it was written as, so a stylesheet
// moved to a different depth still builds and the reference 404s at runtime. This resolves every
// relative `url()` against the file system instead.

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { SOURCE_DIRECTORY, fromRoot, toRootRelative } from "./paths.ts";

import type { Plugin } from "vite";

// The quoted alternatives are tried first so a data URI containing `)` is read as one value rather
// than truncated at the first bracket.
const URL_VALUE = /\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;

// A reference the build does not resolve against a file: a scheme (`data:`, `https:`), a
// protocol-relative or root-relative path, or a fragment.
const NON_FILE_REFERENCE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

/**
 * Returns every relative `url()` in a stylesheet for which `exists` is false, as written and in source
 * order. The query and fragment are removed before `exists` is called, so `./icon.svg#glyph` is checked
 * as `./icon.svg`.
 *
 * Takes the CSS as a value and existence as a predicate so a reference can be checked without files on
 * disk.
 */
export function findUnresolvedUrls(css: string, exists: (path: string) => boolean): Array<string> {
  const unresolved: Array<string> = [];

  for (const [, doubleQuoted, singleQuoted, unquoted] of css.matchAll(URL_VALUE)) {
    const reference = doubleQuoted ?? singleQuoted ?? unquoted ?? "";

    if (reference === "" || NON_FILE_REFERENCE.test(reference)) {
      continue;
    }

    if (!exists(reference.split(/[?#]/)[0] ?? "")) {
      unresolved.push(reference);
    }
  }

  return unresolved;
}

/** Returns the stylesheets under `/src` and every unresolved relative `url()` they contain. */
export async function readUnresolvedUrls(): Promise<{ stylesheets: Array<string>; unresolved: Array<string> }> {
  const entries = await readdir(fromRoot(SOURCE_DIRECTORY), { recursive: true, withFileTypes: true });
  const stylesheets = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => join(entry.parentPath, entry.name));

  const unresolved = (
    await Promise.all(
      stylesheets.map(async (file) => {
        const css = await readFile(file, "utf8");

        return findUnresolvedUrls(css, (path) => existsSync(resolve(dirname(file), path))).map(
          (reference) => `${toRootRelative(file)} references \`${reference}\`, which is not a file`,
        );
      }),
    )
  ).flat();

  return { stylesheets, unresolved };
}

/** Fails the build when a relative `url()` in a stylesheet under `/src` names a path with no file at it. */
export function cssAssetsPlugin(): Plugin {
  return {
    name: "kuzmano.ski:css-assets",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async buildStart() {
      let stylesheets: Array<string>;
      let unresolved: Array<string>;

      try {
        ({ stylesheets, unresolved } = await readUnresolvedUrls());
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        return this.error(`Could not read the stylesheets under ${SOURCE_DIRECTORY}/: ${reason}`);
      }

      for (const file of stylesheets) {
        this.addWatchFile(file);
      }

      if (unresolved.length > 0) {
        this.error(`Unresolved CSS asset: ${unresolved.join("; ")}.`);
      }
    },
  };
}
