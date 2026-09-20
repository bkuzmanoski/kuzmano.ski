import { readFile } from "node:fs/promises";

import { parse } from "yaml";

import { isEntryFile } from "#/lib/content/entry-file.ts";

import type { Plugin } from "vite";

const FRONTMATTER_QUERY = "frontmatter";
const FRONTMATTER_PREFIX = `\0${FRONTMATTER_QUERY}:`;

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Reads the frontmatter block out of MDX source. Returns null when there is none. */
export function frontmatterOf(source: string): unknown {
  const frontmatterMatch = FRONTMATTER_BLOCK.exec(source);
  return frontmatterMatch ? parse(frontmatterMatch[1]!) : null;
}

const moduleFor = (source: string) => `export default ${JSON.stringify(frontmatterOf(source))};`;

/** Exposes `<name>.mdx?frontmatter` as a module containing only an MDX file's frontmatter. */
export function frontmatterPlugin(): Plugin {
  const lastLoadedCode = new Map<string, string>();

  const key = (environment: string, absolutePath: string) => `${environment}\0${absolutePath}`;

  return {
    name: "kuzmano.ski:frontmatter",
    enforce: "pre",
    async resolveId(source, importer) {
      const [path, query] = source.split("?");

      if (!path || !isEntryFile(path) || !query?.split("&").includes(FRONTMATTER_QUERY)) {
        return null;
      }

      const resolvedEntry = await this.resolve(path, importer, { skipSelf: true });

      return resolvedEntry ? `${FRONTMATTER_PREFIX}${resolvedEntry.id}` : null;
    },
    async load(id) {
      if (!id.startsWith(FRONTMATTER_PREFIX)) {
        return null;
      }

      const absolutePath = id.slice(FRONTMATTER_PREFIX.length);
      const code = moduleFor(await readFile(absolutePath, "utf8"));

      lastLoadedCode.set(key(this.environment.name, absolutePath), code);

      return code;
    },
    async hotUpdate({ file, modules, read, type }) {
      if (!isEntryFile(file)) {
        return;
      }

      const module = this.environment.moduleGraph.getModuleById(`${FRONTMATTER_PREFIX}${file}`);

      if (!module) {
        return;
      }

      if (type === "delete") {
        lastLoadedCode.delete(key(this.environment.name, file));
        this.environment.moduleGraph.invalidateModule(module);

        return [...modules, module];
      }

      const nextCode = moduleFor(await read());

      if (nextCode === lastLoadedCode.get(key(this.environment.name, file))) {
        return;
      }

      this.environment.moduleGraph.invalidateModule(module);

      return [...modules, module];
    },
  };
}
