import { parseFrontmatter } from "./schema";

import type { ContentEntry, Frontmatter } from "./schema";
import type { MDXContent } from "mdx/types";

interface MdxModule {
  default: MDXContent;
  frontmatter: unknown;
}

const modules = import.meta.glob<MdxModule>("./**/*.mdx");
const cache = new Map<string, MDXContent>();

const slugOf = (path: string) => path.replace(/^\.\/[^/]+\//, "").replace(/\.mdx$/, "");

function collection(name: string) {
  const entries = Object.entries(modules).filter(([path]) => path.startsWith(`./${name}/`));

  return {
    async list(): Promise<Array<ContentEntry>> {
      const loaded = await Promise.all(
        entries.map(async ([path, load]) => {
          const { frontmatter } = await load();
          return { ...parseFrontmatter(frontmatter, path), slug: slugOf(path) };
        }),
      );

      return loaded
        .filter((entry) => !entry.draft || import.meta.env.DEV)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    },

    async load(slug: string): Promise<Frontmatter | null> {
      const match = entries.find(([path]) => slugOf(path) === slug);

      if (!match) {
        return null;
      }

      const [path, load] = match;
      const module = await load();

      cache.set(`${name}/${slug}`, module.default);

      return parseFrontmatter(module.frontmatter, path);
    },

    component(slug: string): MDXContent {
      const Content = cache.get(`${name}/${slug}`);

      if (!Content) {
        throw new Error(`[content] ${name}/${slug} was not loaded`);
      }

      return Content;
    },

    slugs: () => entries.map(([path]) => slugOf(path)),
  };
}

export const writing = collection("writing");
export const projects = collection("projects");

export type { ContentEntry, Frontmatter };
