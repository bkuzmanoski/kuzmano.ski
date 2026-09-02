import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import { toString } from "hast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";

import { CONTENT_DIRECTORY, fromRoot } from "./paths.ts";
import { shikiTheme } from "./shiki-theme.ts";

import type { Options as AutolinkOptions } from "rehype-autolink-headings";
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
            [rehypeShiki, { theme: shikiTheme, langs: contentLanguages() }],
          ]
        : [rehypeSlug, [rehypeAutolinkHeadings, autolinkOptions]],
    }),
  };
}
