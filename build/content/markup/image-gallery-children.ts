import { visit } from "unist-util-visit";

import { elementNameOf, isJsxElement, isWhitespaceOrComment, quotedEntryPathOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const IMAGE_ELEMENT_NAMES = new Set(["img", "picture"]);
const EXPECTED_CHILDREN = "Expected one or more images, authored in Markdown or as `<img>` or `<picture>` elements.";

const isImage = (node: ContentNode) =>
  (node.type === "element" || isJsxElement(node)) && IMAGE_ELEMENT_NAMES.has(elementNameOf(node) ?? "");

function* galleryChildrenIn(nodes: Array<ContentNode>): Generator<ContentNode> {
  for (const node of nodes) {
    if (node.type === "element" && node.tagName === "p") {
      yield* galleryChildrenIn(node.children ?? []);
    } else if (!isWhitespaceOrComment(node)) {
      yield node;
    }
  }
}

function describedChild(node: ContentNode): string {
  const name = elementNameOf(node);

  if (name) {
    return `a \`<${name}>\` element`;
  }

  return node.type === "text" ? `the text "${node.value?.trim()}"` : "an expression";
}

/** Throws when an entry renders an `<ImageGallery>` without an image or with a child other than an image. */
export function rehypeImageGalleryChildren() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      if (!isJsxElement(node) || elementNameOf(node) !== "ImageGallery") {
        return;
      }

      const children = [...galleryChildrenIn(node.children ?? [])];
      const nonImageChild = children.find((child) => !isImage(child));

      if (nonImageChild) {
        throw new Error(
          `${quotedEntryPathOf(file)} renders an \`ImageGallery\` with ${describedChild(nonImageChild)}. ${EXPECTED_CHILDREN}`,
        );
      }

      if (children.length === 0) {
        throw new Error(
          `${quotedEntryPathOf(file)} renders an \`ImageGallery\` without an image. ${EXPECTED_CHILDREN}`,
        );
      }
    });
  };
}
