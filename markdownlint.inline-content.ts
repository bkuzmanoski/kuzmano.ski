import { entryBodyParser } from "./build/content/markup/entry-syntax.ts";
import { IMAGE_CHILDREN_COMPONENT_NAMES } from "./build/content/markup/image-children.ts";
import { acceptsOnlyInlineContent, rendersInlineContent } from "./build/content/markup/inline-content.ts";
import { elementNameOf, isJsxElement, isJsxFragment } from "./build/content/markup/tree.ts";

import type { ContentNode } from "./build/content/markup/tree.ts";
// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import type { Rule } from "markdownlint";

const HTML_WHITESPACE_PATTERN = /^[\t\n\f\r ]*$/;
const UNRAVELED_TYPES = new Set(["mdxJsxTextElement", "mdxTextExpression"]);

/** The element each mdast node type renders as, for the node types that `rehypeInlineContent` sees as elements. */
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
  /** The element or component the container renders, or `"p"` for a paragraph. */
  name: string;
  /** The parent of the paragraph when the container is a paragraph, otherwise `null`. */
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

/**
 * Matches `remarkMarkAndUnravel` in `@mdx-js/mdx`, which replaces a paragraph of only JSX elements, expressions, and
 * whitespace with its children, so the build renders those children as blocks.
 */
const isUnraveled = (paragraph: ContentNode) =>
  (paragraph.children ?? []).every((child) => UNRAVELED_TYPES.has(child.type) || isBlankText(child));

/**
 * Matches `mdast-util-to-hast`, which renders the items of a list without a paragraph around their text unless the list
 * or one of its items is spread or an item has more than one child.
 */
const isTightList = (list: ContentNode) =>
  list.spread !== true &&
  (list.children ?? []).every((item) => (item.spread ?? (item.children ?? []).length > 1) === false);

/**
 * Whether inserting a blank line before the element makes it a block of its own. It does when the element starts its
 * line and ends the paragraph, after other content, and the paragraph is at the root or in a JSX element. Elsewhere, a
 * blank line can end the container the paragraph is in (e.g., a block quote).
 */
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

/**
 * Yields blocks that `rehypeInlineContent` rejects in contexts that allow only inline content, without traversing those
 * blocks. The build removes paragraphs inside inline-only elements, paragraphs containing only JSX elements (see
 * `isUnraveled`), and paragraphs in tight list items; it renders all other paragraphs as `<p>` elements. Removed
 * paragraphs and fragments contribute their children directly to their parent.
 */
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

/** Reports a block where only inline content may appear, before `rehypeInlineContent` fails the build for it. */
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
