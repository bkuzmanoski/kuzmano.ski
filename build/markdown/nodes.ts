import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { toRootRelative } from "../paths.ts";

import type { ContentNode, EntryVFile } from "../content/markup/tree.ts";

/** Names an entry by its repository-relative path, quoted, for a problem message. */
export const quotedEntryPathOf = ({ path }: EntryVFile) =>
  path ? `"${toRootRelative(path)}"` : "an entry without a path";

/** An mdast `text` node. */
export const textNode = (value: string): ContentNode => ({ type: "text", value });

/** An mdast `paragraph` node containing the given phrasing nodes. */
export const paragraphOf = (children: Array<ContentNode>): ContentNode => ({ type: "paragraph", children });

/** An mdast `paragraph` node containing a single `text` node. */
export const textParagraph = (value: string): ContentNode => paragraphOf([textNode(value)]);

/** An mdast `list` node with one tight item per entry of `items`, each containing that entry's blocks. */
export const listOf = (
  items: Array<Array<ContentNode>>,
  { ordered = false }: { ordered?: boolean } = {},
): ContentNode => ({
  type: "list",
  ordered,
  spread: false,
  children: items.map((children) => ({ type: "listItem", spread: false, children })),
});

/**
 * The blocks an authored element contains. MDX parses an element written on one line as phrasing,
 * which this wraps in a paragraph, and one written across lines as blocks.
 */
export function blocksIn(element: ContentNode): Array<ContentNode> {
  const children = element.children ?? [];

  if (element.type === "mdxJsxTextElement") {
    return children.length > 0 ? [paragraphOf(children)] : [];
  }

  return children;
}

/** Collapses text written over several lines onto the one line a list item or table row occupies. */
export const asOneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export const MARKDOWN_SERIALIZER_OPTIONS = {
  bullet: "-",
  listItemIndent: "one",
  rule: "-",
  fences: true,
  strong: "*",
  emphasis: "_",
} as const;

// Without the GFM extensions an entry is serialized with, so the `~` in a token note is not escaped.
const markdownSerializer = unified().use(remarkStringify, MARKDOWN_SERIALIZER_OPTIONS).freeze();

/**
 * Serializes mdast blocks as a Markdown file, escaping any character in a `text` node that Markdown
 * would otherwise parse as syntax.
 */
export const markdownFrom = (blocks: Array<ContentNode>): string =>
  markdownSerializer.stringify({ type: "root", children: blocks } as Parameters<
    typeof markdownSerializer.stringify
  >[0]);
