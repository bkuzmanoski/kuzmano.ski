import { visit } from "unist-util-visit";

import { RAIL_SUBJECT_COMPONENT_NAMES } from "#/lib/content/rail-subjects.ts";

import {
  elementNameOf,
  hasAttribute,
  hasSpreadAttribute,
  isJsxElement,
  isWhitespaceOrComment,
  quotedEntryPathOf,
  stringAttributeOf,
} from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile, EstreeNode } from "./tree.ts";

export const RAIL_COMPONENT_NAME = "Rail";
export const FOOTNOTE_COMPONENT_NAME = "Footnote";

const RAIL_ASIDE_COMPONENT_NAMES = new Set([RAIL_COMPONENT_NAME, FOOTNOTE_COMPONENT_NAME]);
const RAIL_SUBJECT_NAMES = new Set<string>(RAIL_SUBJECT_COMPONENT_NAMES);
const RAIL_SUBJECT_PROPERTY = "--content-body-rail-subject";

const isRailAside = (node: ContentNode) => isJsxElement(node) && RAIL_ASIDE_COMPONENT_NAMES.has(node.name ?? "");
const isElement = (node: ContentNode) => node.type === "element" || node.type === "mdxJsxFlowElement";

function lastRenderedNodeIn(nodes: Array<ContentNode>): ContentNode | undefined {
  for (let index = nodes.length - 1; index >= 0; index--) {
    if (!isWhitespaceOrComment(nodes[index]!)) {
      return nodes[index];
    }
  }

  return undefined;
}

const railAsidePlacementOf = (aside: ContentNode) =>
  aside.name === FOOTNOTE_COMPONENT_NAME
    ? `references the footnote with the ID "${stringAttributeOf(aside, "id") ?? ""}" inside`
    : `renders a \`${aside.name}\` after`;

const isComponentElement = (node: ContentNode) =>
  node.type === "mdxJsxFlowElement" &&
  (node.name === null || node.name === undefined || !/^[a-z][\w-]*$/.test(node.name));

function railSubjectStyleAttribute(anchorName: string): NonNullable<ContentNode["attributes"]>[number] {
  const literal = (value: string): EstreeNode & { raw: string } => ({
    type: "Literal",
    value,
    raw: JSON.stringify(value),
  });
  const styleObject = {
    type: "ObjectExpression",
    properties: [
      {
        type: "Property",
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
        key: literal(RAIL_SUBJECT_PROPERTY),
        value: literal(anchorName),
      },
    ],
  };

  return {
    type: "mdxJsxAttribute",
    name: "style",
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: `{${JSON.stringify(RAIL_SUBJECT_PROPERTY)}: ${JSON.stringify(anchorName)}}`,
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          comments: [],
          body: [{ type: "ExpressionStatement", expression: styleObject }],
        },
      },
    },
  };
}

function nameRailSubject(subject: ContentNode, anchorName: string) {
  if (subject.attributes) {
    subject.attributes.push(railSubjectStyleAttribute(anchorName));
  } else {
    (subject.properties ??= {}).style = `${RAIL_SUBJECT_PROPERTY}: ${anchorName}`;
  }
}

/**
 * Wraps each root-level run of `Rail` and `Footnote` elements in `<div data-rail-asides>` and assigns
 * a unique rail-subject name to the preceding element.
 *
 * The transform stores the name in `--content-body-rail-subject` on both the subject and its aside
 * group. Content styles combine it with the anchor name for numbered-element labels (using
 * `anchor-name` directly could resolve a shared name to a later subject).
 *
 * Throws entry-specific errors when an aside is nested, lacks a preceding element, follows an
 * unsupported component, or follows an element whose `style` or spread attribute could conflict with
 * the generated style.
 *
 * Must run last so the subject is the element ultimately rendered by the entry.
 */
export function rehypeRailAsides() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    const entryPath = quotedEntryPathOf(file);

    visit(tree, (node: ContentNode, _index, parent: ContentNode | undefined) => {
      if (!isRailAside(node) || parent === tree) {
        return;
      }

      const placement =
        node.type === "mdxJsxTextElement" ? "inside a sentence" : `inside \`<${elementNameOf(parent) ?? ""}>\``;

      throw new Error(`${entryPath} renders a \`${node.name}\` ${placement}.`);
    });

    // Shiki replaces a code block with a root node containing its `<pre>`, which is the element a rail aside after it is beside.
    tree.children = tree.children.flatMap((node) => (node.type === "root" ? (node.children ?? []) : [node]));

    const children: Array<ContentNode> = [];

    let subjectCount = 0;

    for (let index = 0; index < tree.children.length; index++) {
      const node = tree.children[index]!;

      if (!isRailAside(node)) {
        children.push(node);
        continue;
      }

      const subject = lastRenderedNodeIn(children);

      if (subject === undefined || !isElement(subject)) {
        throw new Error(`${entryPath} renders a \`${node.name}\` that does not follow an element.`);
      }

      const problemMessageStart = `${entryPath} ${railAsidePlacementOf(node)} \`<${elementNameOf(subject) ?? ""}>\``;

      if (isComponentElement(subject) && !RAIL_SUBJECT_NAMES.has(subject.name ?? "")) {
        throw new Error(
          `${problemMessageStart}, which it cannot be placed beside. Expected an element or one of: ${RAIL_SUBJECT_COMPONENT_NAMES.join(", ")}.`,
        );
      }

      if (hasAttribute(subject, "style")) {
        throw new Error(`${problemMessageStart} with a \`style\` attribute, which the build sets to place the aside.`);
      }

      if (hasSpreadAttribute(subject)) {
        throw new Error(
          `${problemMessageStart} with a spread attribute, which can set the \`style\` attribute the build sets to place the aside.`,
        );
      }

      const asides = [node];

      for (let nextIndex = index + 1; nextIndex < tree.children.length; nextIndex++) {
        const next = tree.children[nextIndex]!;

        if (isRailAside(next)) {
          asides.push(next);
          index = nextIndex;
        } else if (!isWhitespaceOrComment(next)) {
          break;
        }
      }

      const anchorName = `${RAIL_SUBJECT_PROPERTY}-${++subjectCount}`;

      nameRailSubject(subject, anchorName);
      children.push({
        type: "element",
        tagName: "div",
        properties: { dataRailAsides: "", style: `${RAIL_SUBJECT_PROPERTY}: ${anchorName}` },
        children: asides,
      });
    }

    tree.children = children;
  };
}
