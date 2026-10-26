import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { rehypeCalloutVariants } from "./markup/callout-variants.ts";
import { rehypeCodeFenceAttributes } from "./markup/code-fence-attributes.ts";
import { rehypeContentSpans } from "./markup/content-spans.ts";
import { rehypeElementIds } from "./markup/element-ids.ts";
import { ENTRY_SYNTAX_REMARK_PLUGINS } from "./markup/entry-syntax.ts";
import { remarkFootnoteAsides } from "./markup/footnote-asides.ts";
import { rehypeImageGalleryChildren } from "./markup/image-gallery-children.ts";
import { NO_MEDIA_FOR_ENTRY, rehypeMedia } from "./markup/media-rewrite.ts";
import { rehypeNumberedElements } from "./markup/numbered-elements.ts";
import { rehypeProvidedElements } from "./markup/provided-elements.ts";
import { rehypeRailAsides } from "./markup/rail-asides.ts";
import { shikiTheme } from "./shiki-theme.ts";

import type { MediaForEntry } from "./markup/media-rewrite.ts";
import type { CompileOptions } from "@mdx-js/mdx";
import type { RehypeShikiOptions } from "@shikijs/rehype";
import type { ElementData } from "hast";
import type { Options as AutolinkOptions } from "rehype-autolink-headings";
import type { PluggableList } from "unified";
import type { Plugin } from "vite";

type ShikiTransformer = NonNullable<RehypeShikiOptions["transformers"]>[number];

// Removes Shiki's inline `<pre>` colors so the stylesheet can define them instead.
const PRE_STYLE_REMOVAL_TRANSFORMER: ShikiTransformer = {
  pre(node) {
    delete node.properties.style;
  },
};

// Preserves a code fence's meta string on Shiki's replacement `<code>` element so
// `rehypeCodeFenceAttributes` can read it from both highlighted and unhighlighted blocks.
const META_STRING_PRESERVATION_TRANSFORMER: ShikiTransformer = {
  code(node) {
    const meta = this.options.meta?.__raw;

    if (meta) {
      node.data = { ...node.data, meta } as ElementData; // Cast because `hast-util-from-parse5` requires `position` on `ElementData`, but only verbosely parsed HTML has it.
    }
  },
};

interface MDXOptions {
  syntaxHighlight?: boolean;
  mediaForEntry?: MediaForEntry;
}

/** The options an entry's MDX is compiled with for its document. */
export function mdxCompileOptionsFor({
  syntaxHighlight = true,
  mediaForEntry = NO_MEDIA_FOR_ENTRY,
}: MDXOptions = {}): CompileOptions {
  const rehypePlugins: PluggableList = [
    [rehypeMedia, mediaForEntry], // First, so the elements the other plugins see already name the files the site serves.
    [rehypeProvidedElements, ["video"]], // Renders videos with the site's playback controls (see `/src/features/content/video.tsx`).
    rehypeCalloutVariants,
    rehypeImageGalleryChildren,
    rehypeContentSpans,
    rehypeNumberedElements,
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: "append",
        properties: { "data-heading-link": "" },
        content: [], // The link is empty because `EntrySectionHeading` reads only its `href` attribute and renders its own link in its place (see `/src/features/content/entry-section-heading.tsx`).
      } as AutolinkOptions,
    ],
    rehypeElementIds,
    ...(syntaxHighlight
      ? ([
          [
            rehypeShiki,
            {
              theme: shikiTheme,
              langs: [],
              lazy: true,
              // `addLanguageClass` adds a `language-<name>` class to the highlighted `<code>`, which `CodeBlock`
              // reads for its label (see `/src/features/content/code-block.tsx`).
              addLanguageClass: true,
              transformers: [PRE_STYLE_REMOVAL_TRANSFORMER, META_STRING_PRESERVATION_TRANSFORMER],
            },
          ],
        ] as PluggableList)
      : []),
    rehypeCodeFenceAttributes, // Runs after the highlighter, which replaces each `<pre>` and its properties.
    rehypeRailAsides,
  ];
  return {
    providerImportSource: "@mdx-js/react",
    remarkPlugins: [...ENTRY_SYNTAX_REMARK_PLUGINS, remarkFootnoteAsides],
    rehypePlugins,
    tableCellAlignToStyle: false, // A pipe table's column alignment is emitted as an `align` attribute, which a stylesheet can select on and override, rather than as an inline style.
  };
}

export const mdxPlugin = (options: MDXOptions = {}): Plugin => ({
  enforce: "pre",
  ...mdx(mdxCompileOptionsFor(options)),
});
