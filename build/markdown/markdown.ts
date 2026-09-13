import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { fallbackText } from "#/lib/waitlist/render-fallback.ts";
import { canonicalUrl } from "#/site/metadata.ts";

import { NO_MEDIA_FOR_ENTRY, remarkMedia } from "../content/markup/media-rewrite.ts";
import { JSX_ELEMENT_NODE_TYPES, isJsxElement, stringAttributeOf } from "../content/markup/tree.ts";
import { toRootRelative } from "../paths.ts";

import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { ContentNode, EntryVFile } from "../content/markup/tree.ts";

// Converts an entry's MDX source to the Markdown a reader is served at its `.md` alternate.

interface ComponentMarkdown {
  inline?: boolean;
  replace: (node: ContentNode, context: MarkdownContext) => Array<ContentNode>;
}

// Context available to a component when its content is rewritten as Markdown.
interface MarkdownContext {
  url?: string; // The entry's URL, for a component that needs to link back to it.
}

const paragraph = (value: string): ContentNode => ({ type: "paragraph", children: [{ type: "text", value }] });
const quotedEntryPathOf = ({ path }: EntryVFile) => `"${path ? toRootRelative(path) : "Markdown"}"`; // Names the entry by its repository-relative path.

// Fallback Markdown for React components embedded in the content, keyed by element name.
// A component without fallback Markdown is replaced by its children.
const COMPONENT_MARKDOWN: Record<string, ComponentMarkdown> = {
  Waitlist: { replace: (node, { url }) => (url ? [...(node.children ?? []), paragraph(fallbackText(url))] : []) },
  img: {
    inline: true,
    replace: (node) => {
      const url = stringAttributeOf(node, "src");
      return url ? [{ type: "image", url, alt: stringAttributeOf(node, "alt") ?? "" }] : [];
    },
  },
  // Render videos as file links, using the poster image and `aria-label` when available.
  video: {
    inline: true,
    replace: (node) => {
      const url = stringAttributeOf(node, "src");
      const poster = stringAttributeOf(node, "poster");
      const label = stringAttributeOf(node, "aria-label");

      if (!url) {
        return [];
      }

      return [
        {
          type: "link",
          url,
          children: poster
            ? [{ type: "image", url: poster, alt: label ?? "" }]
            : [{ type: "text", value: label ?? url }],
        },
      ];
    },
  },
};

// Nodes that exist only to serve the compiled component: imports, exports, and `{expressions}`.
const DISCARDED_NODE_TYPES = new Set(["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression"]);
const MDX_NODE_TYPES = new Set([...DISCARDED_NODE_TYPES, ...JSX_ELEMENT_NODE_TYPES]);

/** The name of every component with block fallback Markdown that is written inside a sentence in `tree`. */
function blockFallbacksWrittenInlineIn(tree: ContentNode): Set<string> {
  const componentNames = new Set<string>();

  visit(tree, (node) => {
    const componentMarkdown = node.name ? COMPONENT_MARKDOWN[node.name] : undefined;

    if (node.type === "mdxJsxTextElement" && node.name && componentMarkdown && !componentMarkdown.inline) {
      componentNames.add(node.name);
    }
  });

  return componentNames;
}

// Ensures no component whose fallback Markdown is a block was written inside a sentence, where its
// replacement would be serialized into the prose around it rather than as a block of its own.
function assertBlockFallbacks() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const writtenInline = blockFallbacksWrittenInlineIn(tree);

    if (writtenInline.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} writes components inline whose fallback Markdown is a block: ${[...writtenInline].join(", ")}.`,
      );
    }
  };
}

function replacementsFor(node: ContentNode, context: MarkdownContext): Array<ContentNode> {
  if (DISCARDED_NODE_TYPES.has(node.type)) {
    return [];
  }

  if (isJsxElement(node)) {
    const componentMarkdown = node.name ? COMPONENT_MARKDOWN[node.name] : undefined;

    if (!componentMarkdown) {
      return node.children ?? [];
    }

    const replacementNodes = componentMarkdown.replace(node, context);

    // A block component with an inline fallback produces a phrasing node where a block is expected.
    // `remark-stringify` cannot separate it from the following block, collapsing the document onto
    // one line. Wrap it in a paragraph to ensure it is serialized as a block.
    return componentMarkdown.inline && node.type === "mdxJsxFlowElement"
      ? [{ type: "paragraph", children: replacementNodes }]
      : replacementNodes;
  }

  return [node];
}

// Replaces MDX nodes with plain Markdown nodes that `remark-stringify` can serialize.
function stripMdx(context: MarkdownContext) {
  return function transform(tree: ContentNode) {
    const visitedNodes: Array<ContentNode> = [];

    visit(tree, (node) => {
      visitedNodes.push(node);
    });

    // `visit` visits parents before their descendants, so reversing this list processes children
    // first. This ensures a component promoted in place of its parent is already replaced, rather
    // than leaving nested MDX behind.
    for (const node of visitedNodes.reverse()) {
      if (node.children) {
        node.children = node.children.flatMap((child) => replacementsFor(child, context));
      }
    }
  };
}

function mdxNodeTypesIn(tree: ContentNode): Set<string> {
  const mdxNodeTypes = new Set<string>();

  visit(tree, (node) => {
    if (MDX_NODE_TYPES.has(node.type)) {
      mdxNodeTypes.add(node.name ?? node.type);
    }
  });

  return mdxNodeTypes;
}

// Ensures the Markdown tree contains no MDX nodes. Any MDX that survives `stripMdx`
// would be serialized as JSX and appear verbatim in the Markdown.
function assertMarkdownOnly() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const remainingMdxNodeTypes = mdxNodeTypesIn(tree);

    if (remainingMdxNodeTypes.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} still contains MDX that cannot be written as Markdown: ${[...remainingMdxNodeTypes].join(", ")}.`,
      );
    }
  };
}

const processorFor = (context: MarkdownContext, mediaForEntry: MediaForEntry) =>
  unified()
    .use(remarkParse)
    .use(remarkFrontmatter) // Keeps the frontmatter block which contains the title, description, and date.
    .use(remarkMdx)
    .use(assertBlockFallbacks)
    .use(remarkMedia, mediaForEntry, canonicalUrl) // Resolve media URLs before stripping MDX so the fallback Markdown uses them.
    .use(stripMdx, context)
    .use(assertMarkdownOnly)
    .use(remarkStringify, { bullet: "-", listItemIndent: "one", rule: "-", fences: true, strong: "*", emphasis: "_" });

/** Converts MDX source to the Markdown representation of an entry. */
export async function markdownFor(
  source: string,
  {
    path,
    url,
    mediaForEntry = NO_MEDIA_FOR_ENTRY,
  }: { path?: string; url?: string; mediaForEntry?: MediaForEntry } = {},
): Promise<string> {
  return String(await processorFor({ url }, mediaForEntry).process({ value: source, path }));
}
