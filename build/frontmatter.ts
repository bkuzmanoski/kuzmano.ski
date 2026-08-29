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

const moduleFor = (source: string) => `export default ${JSON.stringify(frontmatterOf(source))};`;

/**
 * Serves `<name>.mdx?frontmatter` as a module that holds the frontmatter alone.
 * The module gets a virtual id, so the MDX pipeline does not also compile it.
 */
export function frontmatterPlugin(): Plugin {
  const lastLoadedCode = new Map<string, string>();

  const key = (environment: string, path: string) => `${environment}\0${path}`;

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

      const path = id.slice(PREFIX.length);
      const code = moduleFor(await readFile(path, "utf8"));

      lastLoadedCode.set(key(this.environment.name, path), code);

      return code;
    },
    async hotUpdate({ file, modules, read, type }) {
      if (!file.endsWith(".mdx")) {
        return;
      }

      const module = this.environment.moduleGraph.getModuleById(`${PREFIX}${file}`);

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
