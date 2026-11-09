import { contentComponentNamesWhere } from "#/features/content/content-components.ts";

import { IMAGE_CHILDREN_COMPONENT_NAMES } from "./image-children.ts";
import { elementNameOf, isJsxElement, isJsxFragment, quotedEntryPathOf, quotedNameOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

/** The HTML elements that are phrasing content (see https://html.spec.whatwg.org/#phrasing-content). */
const PHRASING_ELEMENT_NAMES = new Set([
  "a",
  "abbr",
  "area",
  "audio",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "canvas",
  "cite",
  "code",
  "data",
  "datalist",
  "del",
  "dfn",
  "em",
  "embed",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "map",
  "mark",
  "math",
  "meter",
  "noscript",
  "object",
  "output",
  "picture",
  "progress",
  "q",
  "ruby",
  "s",
  "samp",
  "script",
  "select",
  "slot",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "template",
  "textarea",
  "time",
  "u",
  "var",
  "video",
  "wbr",
]);

/**
 * The HTML elements whose content model is phrasing content, and `<a>`, `<del>`, and `<ins>`, whose transparent content
 * model inherits it inside them.
 */
const INLINE_CONTEXT_ELEMENT_NAMES = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "button",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "ins",
  "kbd",
  "label",
  "legend",
  "mark",
  "meter",
  "output",
  "p",
  "pre",
  "progress",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "time",
  "u",
  "var",
]);

const INLINE_COMPONENT_NAMES = new Set<string>(contentComponentNamesWhere(({ renders }) => renders === "inline"));
const INLINE_CHILDREN_COMPONENT_NAMES = new Set<string>(
  contentComponentNamesWhere(({ renders, childContent }) => renders === "inline" || childContent !== undefined),
);
const CUSTOM_ELEMENT_NAME_PATTERN = /^[a-z][^A-Z.]*-/;

const isElement = (node: ContentNode) => node.type === "element" || isJsxElement(node);
const isParagraph = (node: ContentNode | undefined) => node?.type === "element" && node.tagName === "p";

/** Whether an element or component renders inline content, so it may appear where only inline content may. */
export function rendersInlineContent(name: string | null): boolean {
  return (
    name !== null &&
    (PHRASING_ELEMENT_NAMES.has(name) || INLINE_COMPONENT_NAMES.has(name) || CUSTOM_ELEMENT_NAME_PATTERN.test(name))
  );
}

/**
 * Whether an element or component accepts only inline content as its children. An `<a>`, `<del>`, or `<ins>` accepts
 * what its parent accepts.
 */
export function acceptsOnlyInlineContent(name: string | null, parentAcceptsOnlyInlineContent: boolean): boolean {
  if (name === "a" || name === "del" || name === "ins") {
    return parentAcceptsOnlyInlineContent;
  }

  return name !== null && (INLINE_CONTEXT_ELEMENT_NAMES.has(name) || INLINE_CHILDREN_COMPONENT_NAMES.has(name));
}

const describedContainer = (name: string) => (name === "p" ? "a paragraph" : quotedNameOf(name));

/**
 * Whether a child of an element that accepts only inline content starts a line of its own in the source: a paragraph,
 * or an element MDX parsed as a block.
 */
const isOwnLine = (node: ContentNode | undefined) => isParagraph(node) || node?.type === "mdxJsxFlowElement";

const lineBreak = (): ContentNode => ({ type: "text", value: "\n" });

/**
 * Replaces each paragraph with its children. Separates two children on lines of their own with a line break, as a
 * paragraph separates its lines, so the text of consecutive paragraphs does not run together.
 */
const childrenWithoutParagraphs = (children: Array<ContentNode>) =>
  children.flatMap((child, index) => [
    ...(index > 0 && isOwnLine(child) && isOwnLine(children[index - 1]) ? [lineBreak()] : []),
    ...(isParagraph(child) ? (child.children ?? []) : [child]),
  ]);

/**
 * Removes the paragraphs inside elements and components that accept only inline content, so Markdown authored on lines
 * of its own inside an `<AlertButton>` or `<ImageRow>` (e.g., an image) renders without a paragraph around it. Throws
 * for a block inside one of them, except among the direct children of a component in `IMAGE_CHILDREN_COMPONENT_NAMES`,
 * which `rehypeImageChildren` checks with a message that names what it accepts. Checks the children of a fragment as
 * children of its parent, as a fragment renders its children in its place.
 *
 * Run after `rehypeMedia`, which wraps an image in a `<picture>`, and before `rehypeImageChildren`, which expects the
 * images in an `ImageGallery` without paragraphs around them.
 */
export function rehypeInlineContent() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    const visitChildrenOf = (parent: ContentNode, containerName: string | null) => {
      if (containerName !== null) {
        parent.children = childrenWithoutParagraphs(parent.children ?? []);
      }

      const reportsBlocks = containerName !== null && !IMAGE_CHILDREN_COMPONENT_NAMES.has(containerName);

      for (const child of parent.children ?? []) {
        if (isJsxFragment(child)) {
          visitChildrenOf(child, containerName);
          continue;
        }

        const name = isElement(child) ? elementNameOf(child) : null;

        if (reportsBlocks && name !== null && !rendersInlineContent(name)) {
          const expectation =
            containerName === "p"
              ? "Expected a blank line between the paragraph and the element."
              : "Expected inline content (e.g., text, images, and links).";

          throw new Error(
            `${quotedEntryPathOf(file)} renders ${quotedNameOf(name)} inside ${describedContainer(containerName)} on line ${child.position?.start.line ?? "?"}. ${expectation}`,
          );
        }

        visitChildrenOf(child, acceptsOnlyInlineContent(name, containerName !== null) ? name : null);
      }
    };

    visitChildrenOf(tree, null);
  };
}
