import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

import { CONTENT_DIRECTORY, fromRoot } from "./paths.ts";
import { shikiTheme } from "./shiki-theme.ts";

import type { Plugin } from "vite";

const FENCE = /^[ \t]*(?:```|~~~)([\w#+-]+)/gm;

// Shiki loads all ~350 of its bundled grammars unless `langs` names the few in use.
function contentLanguages(): Array<string> {
  const languages = new Set<string>();

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(directory, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        for (const [, language] of readFileSync(join(directory, entry.name), "utf8").matchAll(FENCE)) {
          languages.add(language!);
        }
      }
    }
  };

  walk(fromRoot(CONTENT_DIRECTORY));

  return [...languages];
}

export function mdxPlugin({ syntaxHighlight = true } = {}): Plugin {
  return {
    enforce: "pre",
    ...mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      rehypePlugins: syntaxHighlight
        ? [rehypeSlug, rehypeAutolinkHeadings, [rehypeShiki, { theme: shikiTheme, langs: contentLanguages() }]]
        : [rehypeSlug, rehypeAutolinkHeadings],
    }),
  };
}
