import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

import { shikiTheme } from "./shiki-theme.ts";

import type { Plugin } from "vite";

export function mdxPlugin({ syntaxHighlight = true } = {}): Plugin {
  return {
    enforce: "pre",
    ...mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      rehypePlugins: syntaxHighlight ? [rehypeSlug, [rehypeShiki, { theme: shikiTheme }]] : [rehypeSlug],
    }),
  };
}
