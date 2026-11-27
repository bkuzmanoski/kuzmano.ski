import { entryBodyParser } from "./build/content/markup/entry-syntax.ts";
import { IMAGE_CHILDREN_COMPONENT_NAMES } from "./build/content/markup/image-children.ts";
import { acceptsOnlyInlineContent, rendersInlineContent } from "./build/content/markup/inline-content.ts";
import { elementNameOf, isJsxElement, isJsxFragment } from "./build/content/markup/tree.ts";

import type { ContentNode } from "./build/content/markup/tree.ts";
// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import type { Rule } from "markdownlint";

const HTML_WHITESPACE_PATTERN = /^[\t\n\f\r ]*$/;
const UNRAVELED_TYPES = new Set(["mdxJsxTextElement", "mdxTextExpression"]);

// Maps mdast node types that `rehypeInlineContent` treats as elements to their rendered HTML element names.
const RENDERED_ELEMENT_NAMES: Record<string, string | undefined> = {
  blockquote: "blockquote",
  break: "br",
  code: "pre",
  delete: "del",
  emphasis: "em",
  image: "img",
  imageReference: "img",
  inlineCode: "code",
  link: "a",
  linkReference: "a",
  strong: "strong",
  table: "table",
  thematicBreak: "hr",
};

interface InlineContentContainer {
  node: ContentNode;
  /** Rendered element or component name, or `"p"` for a paragraph. */
  name: string;
  /** Parent node when the container is a paragraph, otherwise `null`. */
  paragraphParent: ContentNode | null;
}

interface BlockInInlineContent {
  block: ContentNode;
  blockName: string;
  container: InlineContentContainer;
}

const isBlankText = (node: ContentNode) => node.type === "text" && HTML_WHITESPACE_PATTERN.test(node.value ?? "");

function renderedElementNameOf(node: ContentNode): string | null {
  if (isJsxElement(node)) {
    return elementNameOf(node);
  }

  if (node.type === "heading") {
    return `h${node.depth ?? 1}`;
  }

  if (node.type === "list") {
    return node.ordered ? "ol" : "ul";
  }

  return RENDERED_ELEMENT_NAMES[node.type] ?? null;
}

// Matches `remarkMarkAndUnravel` in `@mdx-js/mdx`, which unwraps paragraphs containing only JSX, expressions, and
// whitespace into block children.
const isUnraveled = (paragraph: ContentNode) =>
  (paragraph.children ?? []).every((child) => UNRAVELED_TYPES.has(child.type) || isBlankText(child));

// Matches `mdast-util-to-hast`, which omits `<p>` in list items unless the list or item is spread or has multiple
// children.
const isTightList = (list: ContentNode) =>
  list.spread !== true &&
  (list.children ?? []).every((item) => (item.spread ?? (item.children ?? []).length > 1) === false);

// Whether inserting a blank line before the element splits it into its own block (only safe at root or in a JSX
// element; elsewhere a blank line can terminate containers like block quotes).
function canSplitBefore(lines: ReadonlyArray<string>, { block, container }: BlockInInlineContent) {
  const siblings = container.node.children ?? [];
  const blockIndex = siblings.indexOf(block);
  const start = block.position?.start;
  const { paragraphParent } = container;

  return (
    paragraphParent !== null &&
    blockIndex !== -1 &&
    start !== undefined &&
    lines[start.line - 1]?.slice(0, start.column - 1).trim() === "" &&
    siblings.slice(0, blockIndex).some((sibling) => !isBlankText(sibling)) &&
    siblings.slice(blockIndex + 1).every(isBlankText) &&
    (paragraphParent.type === "root" || isJsxElement(paragraphParent))
  );
}

// Yields block nodes rejected by `rehypeInlineContent` inside inline-only contexts without descending into them.
// Mirrors the build's paragraph unwrapping (inline-only elements, unraveled JSX paragraphs, tight list items).
function* blocksInInlineContentIn(
  parent: ContentNode,
  container: InlineContentContainer | null,
  isInTightListItem = false,
): Generator<BlockInInlineContent> {
  const reportingContainer =
    container !== null && !IMAGE_CHILDREN_COMPONENT_NAMES.has(container.name) ? container : null;

  for (const child of parent.children ?? []) {
    if (isJsxFragment(child)) {
      yield* blocksInInlineContentIn(child, container, isInTightListItem);
      continue;
    }

    if (child.type === "paragraph") {
      const isRemoved = container !== null || isUnraveled(child) || isInTightListItem;

      yield* blocksInInlineContentIn(
        child,
        isRemoved ? container : { node: child, name: "p", paragraphParent: parent },
      );

      continue;
    }

    const name = renderedElementNameOf(child);

    if (reportingContainer !== null && name !== null && !rendersInlineContent(name)) {
      yield { block: child, blockName: name, container: reportingContainer };
      continue;
    }

    const childAcceptsOnlyInlineContent = acceptsOnlyInlineContent(name, container !== null);

    yield* blocksInInlineContentIn(
      child,
      childAcceptsOnlyInlineContent && name !== null ? { node: child, name, paragraphParent: null } : null,
      child.type === "listItem" && parent.type === "list" && isTightList(parent),
    );
  }
}

// Reports blocks in inline-only contexts before `rehypeInlineContent` fails the build.
const inlineContentRule: Rule = {
  names: ["inline-content"],
  description: "An element that accepts only inline content should not contain a block",
  tags: ["html"],
  parser: "none",
  function: (params, onError) => {
    let tree: ContentNode;

    try {
      tree = entryBodyParser.parse(params.lines.join("\n"));
    } catch {
      return; // The build reports MDX that does not parse.
    }

    for (const blockInInlineContent of blocksInInlineContentIn(tree, null)) {
      const { block, blockName, container } = blockInInlineContent;
      const start = block.position?.start;

      if (!start) {
        continue;
      }

      onError({
        lineNumber: start.line,
        detail:
          container.name === "p"
            ? `Expected a blank line between the paragraph and <${blockName}>`
            : `Expected inline content inside <${container.name}>, not <${blockName}>`,
        ...(canSplitBefore(params.lines, blockInInlineContent) && { fixInfo: { editColumn: 1, insertText: "\n" } }),
      });
    }
  },
};

export default inlineContentRule;
