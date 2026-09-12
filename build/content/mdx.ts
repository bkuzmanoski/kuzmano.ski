import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import { toString } from "hast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";

import { NO_MEDIA_FOR_ENTRY, rehypeMedia } from "./markup/media-rewrite.ts";
import { shikiTheme } from "./shiki-theme.ts";

import type { MediaForEntry } from "./markup/media-rewrite.ts";
import type { Options as AutolinkOptions } from "rehype-autolink-headings";
import type { PluggableList } from "unified";
import type { Plugin } from "vite";

interface MDXOptions {
  syntaxHighlight?: boolean;
  mediaForEntry?: MediaForEntry;
}

export function mdxPlugin({ syntaxHighlight = true, mediaForEntry = NO_MEDIA_FOR_ENTRY }: MDXOptions = {}): Plugin {
  const rehypePlugins: PluggableList = [
    [rehypeMedia, mediaForEntry], // First, so the elements the other plugins see already name the files the site serves.
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: "append",
        properties: (heading) => ({ "data-heading-link": "", ariaLabel: `Link to "${toString(heading)}"` }),
        content: {
          type: "element",
          tagName: "span",
          properties: { ariaHidden: "true" },
          children: [{ type: "text", value: "#" }],
        },
      } as AutolinkOptions,
    ],
    ...(syntaxHighlight ? ([[rehypeShiki, { theme: shikiTheme, langs: [], lazy: true }]] as PluggableList) : []),
  ];

  return {
    enforce: "pre",
    ...mdx({ providerImportSource: "@mdx-js/react", remarkPlugins: [remarkFrontmatter], rehypePlugins }),
  };
}
