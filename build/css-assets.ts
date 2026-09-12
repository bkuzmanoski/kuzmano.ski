import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { parse } from "postcss";
import valueParser from "postcss-value-parser";

import { CLIENT_ENVIRONMENT } from "./environments.ts";
import { SOURCE_DIRECTORY_PATH, fromRoot, toRootRelative } from "./paths.ts";

import type { Plugin } from "vite";

const NON_FILE_REFERENCE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i; // References that do not resolve to local files: schemes, absolute paths, and fragments.
const QUERY_OR_FRAGMENT = /(?<!\\)[?#]/; // Matches the first unescaped query or fragment delimiter. Escaped `\?` and `\#` remain part of the path. Escaped backslashes are not distinguished.
const CSS_ESCAPE = /\\(?:([\da-f]{1,6})[ \t\n]?|([^\da-f]))/gi; // Matches a CSS escape: a one-to-six-digit code point or a literal character.

function filePathOf(reference: string): string {
  return (reference.split(QUERY_OR_FRAGMENT)[0] ?? "").replace(
    CSS_ESCAPE,
    (_, codePoint: string | undefined, character: string | undefined) =>
      codePoint === undefined ? (character ?? "") : String.fromCodePoint(Number.parseInt(codePoint, 16)),
  ); // Decoding allows escaped paths to resolve correctly.
}

/** Returns `url()` references from a declaration value or at-rule prelude in source order. */
export function urlsIn(value: string): Array<string> {
  const references: Array<string> = [];

  valueParser(value).walk((node) => {
    if (node.type !== "function" || node.value !== "url") {
      return;
    }

    // `url()` holds an unquoted reference in a `word` node and a quoted one in a `string` node,
    // so a quoted value keeps any bracket it contains rather than ending the reference.
    const [argument] = node.nodes;
    const reference = argument?.type === "word" || argument?.type === "string" ? argument.value : "";

    if (reference !== "") {
      references.push(reference);
    }
  });

  return references;
}

/**
 * Returns unresolved relative `url()` references in source order.
 *
 * Removes queries, fragments, and CSS escapes before calling `exists`.
 */
export function unresolvedUrlsIn(css: string, exists: (filePath: string) => boolean): Array<string> {
  const unresolvedReferences: Array<string> = [];

  const collectUnresolved = (value: string) => {
    for (const reference of urlsIn(value)) {
      if (!NON_FILE_REFERENCE.test(reference) && !exists(filePathOf(reference))) {
        unresolvedReferences.push(reference);
      }
    }
  };

  // Check declarations and at-rule preludes because `@import` references appear in the prelude.
  parse(css).walk((node) => {
    if (node.type === "decl") {
      collectUnresolved(node.value);
    } else if (node.type === "atrule") {
      collectUnresolved(node.params);
    }
  });

  return unresolvedReferences;
}

/** Returns stylesheets under `/src` and unresolved relative `url()` references in each. */
export async function readStylesheets(): Promise<{ stylesheetAbsolutePaths: Array<string>; problems: Array<string> }> {
  const entries = await readdir(fromRoot(SOURCE_DIRECTORY_PATH), { recursive: true, withFileTypes: true });
  const stylesheetAbsolutePaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => join(entry.parentPath, entry.name));

  const problems = (
    await Promise.all(
      stylesheetAbsolutePaths.map(async (stylesheetAbsolutePath) => {
        const css = await readFile(stylesheetAbsolutePath, "utf8");
        return unresolvedUrlsIn(css, (filePath) => existsSync(resolve(dirname(stylesheetAbsolutePath), filePath))).map(
          (reference) => `${toRootRelative(stylesheetAbsolutePath)} references \`${reference}\`, which is not a file.`,
        );
      }),
    )
  ).flat();

  return { stylesheetAbsolutePaths, problems };
}

/** Fails client builds when a relative `url()` in `/src` CSS does not resolve. */
export function cssAssetsPlugin(): Plugin {
  return {
    name: "kuzmano.ski:css-assets",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async buildStart() {
      let stylesheetAbsolutePaths: Array<string>;
      let problems: Array<string>;

      try {
        ({ stylesheetAbsolutePaths, problems } = await readStylesheets());
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        return this.error(`Could not read the stylesheets under ${SOURCE_DIRECTORY_PATH}/: ${reason}`);
      }

      for (const stylesheetAbsolutePath of stylesheetAbsolutePaths) {
        this.addWatchFile(stylesheetAbsolutePath);
      }

      if (problems.length > 0) {
        this.error(problems.join(" "));
      }
    },
  };
}
