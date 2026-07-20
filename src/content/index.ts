import { parseFrontmatter } from "./schema";

import type { ContentEntry, Frontmatter } from "./schema";
import type { MDXContent } from "mdx/types";

interface MDXModule {
  default: MDXContent;
  frontmatter: unknown;
}

/**
 * Lazy (not `eager`) so each post compiles to its own chunk. Listing pages read
 * frontmatter through a route loader, and because those loaders run during
 * prerender their results are serialized into the HTML—the client renders an
 * index without downloading any post chunks.
 */
const modules = import.meta.glob<MDXModule>("./**/*.mdx");

/**
 * Caches the import *promise*, not the resolved module, so it can be read during
 * render via `use()`.
 *
 * A loader cannot be what populates this: on hydration TanStack restores
 * serialized loader data and skips running the loader, so a cache filled as a
 * loader side effect is empty on the client for the first page a visitor lands
 * on—which renders the error boundary instead of the post.
 */
const moduleCache = new Map<string, Promise<MDXModule>>();

const slugOf = (path: string) => path.replace(/^\.\/[^/]+\//, "").replace(/\.mdx$/, "");

export interface Collection {
  list: () => Promise<Array<ContentEntry>>;
  frontmatter: (slug: string) => Promise<Frontmatter | null>;
  module: (slug: string) => Promise<MDXModule>;
}

function collection(name: string): Collection {
  const entries = Object.entries(modules).filter(([path]) => path.startsWith(`./${name}/`));

  const pathOf = (slug: string) => entries.find(([path]) => slugOf(path) === slug)?.[0];

  /**
   * Every read goes through here, so a given post is imported once per session
   * no matter which entry point asked for it. Returning an identical promise per
   * slug also matters for `use()`, which would suspend forever on a promise whose
   * identity changed each render.
   */
  const load = (path: string) => {
    const cached = moduleCache.get(path);

    if (cached) {
      return cached;
    }

    const loader = modules[path];

    if (!loader) {
      throw new Error(`[content] no such entry: ${path}`);
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

    /** For route loaders: returns only frontmatter, which is serializable. */
    async frontmatter(slug) {
      const path = pathOf(slug);

      return path ? parseFrontmatter((await load(path)).frontmatter, path) : null;
    },

    /** Safe to call during render; pair with `use()`. */
    module(slug) {
      const path = pathOf(slug);

      if (!path) {
        throw new Error(`[content] no such entry: ${name}/${slug}`);
      }

      return load(path);
    },
  };
}

export const writing = collection("writing");
export const projects = collection("projects");

export type { ContentEntry, Frontmatter };
