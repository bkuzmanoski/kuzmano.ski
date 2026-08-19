import { readFile } from "node:fs/promises";

import { parse } from "yaml";

import type { Plugin } from "vite";

const QUERY = "frontmatter";
const PREFIX = "\0frontmatter:";
const BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Reads the frontmatter block out of MDX source. Returns null when there is none. */
export function frontmatterOf(source: string): unknown {
  const block = BLOCK.exec(source);
  return block ? parse(block[1]!) : null;
}

/**
 * Serves `<name>.mdx?frontmatter` as a module that holds the frontmatter alone.
 * The module gets a virtual id, so the MDX pipeline does not also compile it.
 */
export function frontmatterPlugin(): Plugin {
  return {
    name: "kuzmano.ski:frontmatter",
    enforce: "pre",
    async resolveId(source, importer) {
      const [path, query] = source.split("?");

      if (!path?.endsWith(".mdx") || !query?.split("&").includes(QUERY)) {
        return null;
      }

      const resolved = await this.resolve(path, importer, { skipSelf: true });

      return resolved ? `${PREFIX}${resolved.id}` : null;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }

      const source = await readFile(id.slice(PREFIX.length), "utf8");

      return `export default ${JSON.stringify(frontmatterOf(source))};`;
    },
  };
}
