import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import { toString } from "hast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";

import { shikiTheme } from "./shiki-theme.ts";

import type { Options as AutolinkOptions } from "rehype-autolink-headings";
import type { Plugin } from "vite";

const autolinkOptions: AutolinkOptions = {
  behavior: "append",
  properties: (heading) => ({ "data-heading-link": "", ariaLabel: `Link to "${toString(heading)}"` }),
  content: {
    type: "element",
    tagName: "span",
    properties: { ariaHidden: "true" },
    children: [{ type: "text", value: "#" }],
  },
};

export function mdxPlugin({ syntaxHighlight = true } = {}): Plugin {
  return {
    enforce: "pre",
    ...mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter],
      rehypePlugins: syntaxHighlight
        ? [
            rehypeSlug,
            [rehypeAutolinkHeadings, autolinkOptions],
            [rehypeShiki, { theme: shikiTheme, langs: [], lazy: true }],
          ]
        : [rehypeSlug, [rehypeAutolinkHeadings, autolinkOptions]],
    }),
  };
}
