import { visit } from "unist-util-visit";

import { contentComponentNamesWhere } from "#/features/content/content-components.ts";

import {
  elementNameOf,
  isJsxElement,
  isJsxFragment,
  isWhitespaceOrComment,
  quotedEntryPathOf,
  quotedNameOf,
} from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

export const IMAGE_CHILDREN_COMPONENT_NAMES: ReadonlySet<string> = new Set(
  contentComponentNamesWhere(({ childContent }) => childContent === "images"),
);

const IMAGE_ELEMENT_NAMES = new Set(["img", "picture"]);
const EXPECTED_CHILDREN = "Expected one or more images, authored in Markdown or as `<img>` or `<picture>` elements.";

const isImage = (node: ContentNode) =>
  (node.type === "element" || isJsxElement(node)) && IMAGE_ELEMENT_NAMES.has(elementNameOf(node) ?? "");

/**
 * Does not look inside paragraphs, as `rehypeInlineContent` removes the paragraphs around images authored in Markdown.
 */
const imageChildrenIn = (nodes: Array<ContentNode>) => nodes.filter((node) => !isWhitespaceOrComment(node));

function describedChild(node: ContentNode): string {
  if (isJsxFragment(node)) {
    return "a fragment";
  }

  const name = elementNameOf(node);

  if (name) {
    return `${quotedNameOf(name)} as a child`;
  }

  return node.type === "text" ? `the text "${node.value?.trim()}"` : "an expression";
}

/**
 * Throws when an entry renders a component in `IMAGE_CHILDREN_COMPONENT_NAMES` without an image or with a child other
 * than an image.
 */
export function rehypeImageChildren() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      if (!isJsxElement(node) || !IMAGE_CHILDREN_COMPONENT_NAMES.has(node.name ?? "")) {
        return;
      }

      const component = quotedNameOf(node.name ?? "");

      const children = imageChildrenIn(node.children ?? []);
      const nonImageChild = children.find((child) => !isImage(child));

      if (nonImageChild) {
        throw new Error(
          `${quotedEntryPathOf(file)} renders ${component} with ${describedChild(nonImageChild)}. ${EXPECTED_CHILDREN}`,
        );
      }

      if (children.length === 0) {
        throw new Error(`${quotedEntryPathOf(file)} renders ${component} without an image. ${EXPECTED_CHILDREN}`);
      }
    });
  };
}
