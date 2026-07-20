import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

import type { Plugin } from "vite";

/**
 * Shared so the test run compiles MDX the same way the build does. Highlighting
 * is skipped under test: it is the slowest part of the pipeline and nothing
 * asserts on token markup.
 */
export function mdxPlugin({ highlight = true } = {}): Plugin {
  return {
    // Must compile to JSX before viteReact and the React Compiler transform it.
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
                // Emit both themes as CSS variables with no baked-in default so
                // styles.css can resolve them with light-dark().
                defaultColor: false,
              },
            ],
          ]
        : [rehypeSlug],
    }),
  };
}
