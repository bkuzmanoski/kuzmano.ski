import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

import type { Plugin } from "vite";

export function mdxPlugin({ highlight = true } = {}): Plugin {
  return {
    enforce: "pre",
    ...mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
      rehypePlugins: highlight
        ? [
            rehypeSlug,
            [
              rehypeShiki,
              {
                themes: { light: "github-light", dark: "github-dark" },
                defaultColor: false,
              },
            ],
          ]
        : [rehypeSlug],
    }),
  };
}
