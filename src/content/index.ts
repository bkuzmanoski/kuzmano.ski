import { parseFrontmatter } from "./schema";

import type { ContentEntry, Frontmatter } from "./schema";
import type { MDXContent } from "mdx/types";

interface MDXModule {
  default: MDXContent;
  frontmatter: unknown;
}

export interface Collection {
  list: () => Promise<Array<ContentEntry>>;
  frontmatter: (slug: string) => Promise<Frontmatter | null>;
  module: (slug: string) => Promise<MDXModule>;
}

const modules = import.meta.glob<MDXModule>("./**/*.mdx");
const moduleCache = new Map<string, Promise<MDXModule>>();

const slugOf = (path: string) => path.replace(/^\.\/[^/]+\//, "").replace(/\.mdx$/, "");

function collection(name: string): Collection {
  const entries = Object.entries(modules).filter(([path]) => path.startsWith(`./${name}/`));

  const pathOf = (slug: string) => entries.find(([path]) => slugOf(path) === slug)?.[0];
  const load = (path: string) => {
    const cached = moduleCache.get(path);

    if (cached) {
      return cached;
    }

    const loader = modules[path];

    if (!loader) {
      throw new Error(`[CONTENT] Entry not found: ${path}`);
    }

    const promise = loader();
    moduleCache.set(path, promise);

    return promise;
  };

  return {
    async list() {
      const loaded = await Promise.all(
        entries.map(async ([path]) => ({
          ...parseFrontmatter((await load(path)).frontmatter, path),
          slug: slugOf(path),
        })),
      );

      return loaded
        .filter((entry) => !entry.draft || import.meta.env.DEV)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    },

    async frontmatter(slug) {
      const path = pathOf(slug);
      return path ? parseFrontmatter((await load(path)).frontmatter, path) : null;
    },

    module(slug) {
      const path = pathOf(slug);

      if (!path) {
        throw new Error(`[CONTENT] Entry not found: ${name}/${slug}`);
      }

      return load(path);
    },
  };
}

export const writing = collection("writing");
export const projects = collection("projects");

export type { ContentEntry, Frontmatter };
