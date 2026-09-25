import { visit } from "unist-util-visit";

import { elementNameOf } from "../content/markup/tree.ts";

import { blocksIn, listOf, paragraphOf, textNode } from "./nodes.ts";

import type { ContentNode, ContentParent } from "../content/markup/tree.ts";

// Writes the `<ul>`, `<ol>`, and `<dl>` elements in an entry as Markdown lists in its Markdown
// representation.

// MDX parses an element written on one line as phrasing inside a paragraph, so the items of a list
// are found through the paragraphs between them.
function listChildrenIn(list: ContentNode, names: ReadonlySet<string>): Array<ContentNode> {
  return (list.children ?? []).flatMap((child) => {
    if (child.type === "paragraph") {
      return listChildrenIn(child, names);
    }

    return names.has(elementNameOf(child) ?? "") ? [child] : [];
  });
}

const DESCRIPTION_LIST_CHILD_NAMES = new Set(["dt", "dd"]);

interface DescriptionGroup {
  terms: Array<ContentNode>;
  descriptions: Array<ContentNode>;
}

function descriptionGroupsIn(list: ContentNode): Array<DescriptionGroup> {
  const groups: Array<DescriptionGroup> = [];

  for (const child of listChildrenIn(list, DESCRIPTION_LIST_CHILD_NAMES)) {
    const isTerm = elementNameOf(child) === "dt";
    let group = groups.at(-1);

    if (!group || (isTerm && group.descriptions.length > 0)) {
      group = { terms: [], descriptions: [] };
      groups.push(group);
    }

    (isTerm ? group.terms : group.descriptions).push(child);
  }

  return groups;
}

const termPhrasingIn = (term: ContentNode): Array<ContentNode> =>
  blocksIn(term).flatMap((block) => (block.type === "paragraph" ? (block.children ?? []) : []));

/**
 * A group's terms in bold, then a colon and its descriptions' blocks. The first block, when it is a
 * paragraph, continues the terms' line, so a one-line description reads `**Term**: Description.`.
 */
function descriptionListItemFrom({ terms, descriptions }: DescriptionGroup): Array<ContentNode> {
  const blocks = descriptions.flatMap(blocksIn);

  if (terms.length === 0) {
    return blocks;
  }

  const strongTerms = terms.flatMap((term, index) => [
    ...(index > 0 ? [textNode(", ")] : []),
    { type: "strong", children: termPhrasingIn(term) },
  ]);
  const [firstBlock, ...otherBlocks] = blocks;

  if (firstBlock?.type !== "paragraph") {
    return [paragraphOf(strongTerms), ...blocks];
  }

  return [paragraphOf([...strongTerms, textNode(": "), ...(firstBlock.children ?? [])]), ...otherBlocks];
}

const LIST_ITEM_NAMES = new Set(["li"]);

function listMarkdownNodeFrom(list: ContentNode): ContentNode {
  const name = elementNameOf(list);

  if (name === "dl") {
    return listOf(descriptionGroupsIn(list).map(descriptionListItemFrom));
  }

  return listOf(listChildrenIn(list, LIST_ITEM_NAMES).map(blocksIn), { ordered: name === "ol" });
}

const LIST_NAMES = new Set(["ul", "ol", "dl"]);

/**
 * Replaces each `<ul>`, `<ol>`, and `<dl>` written as a block with a Markdown list: one item per
 * `<li>`, or per group of `<dt>` elements and the `<dd>` elements after them.
 */
export function remarkAuthoredLists() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (node.type !== "mdxJsxFlowElement" || !LIST_NAMES.has(node.name ?? "") || !parent || index === undefined) {
        return undefined;
      }

      parent.children.splice(index, 1, listMarkdownNodeFrom(node));

      return index; // Visits the replacement, so a list nested in an item is rewritten too.
    });
  };
}
