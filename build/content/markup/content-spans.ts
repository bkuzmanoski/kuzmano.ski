import { visit } from "unist-util-visit";

import { CONTENT_SPANS } from "#/lib/content/content-spans.ts";

import { toRootRelative } from "../../paths.ts";

import { elementNameOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const CONTENT_SPAN_NAMES = new Set<string>(CONTENT_SPANS);
const SPAN_ATTRIBUTE_NAME = "data-content-span";

// Reads the attribute from authored JSX, or from a hast element such as the `<picture>` that
// `rehypeMedia` moves an authored `<img>`'s layout attributes to. Returns `undefined` when the
// element does not have the attribute.
function spanAttributeOf(node: ContentNode): { value?: unknown } | undefined {
  if (node.attributes) {
    return node.attributes.find(({ name }) => name === SPAN_ATTRIBUTE_NAME);
  }

  if (node.properties && SPAN_ATTRIBUTE_NAME in node.properties) {
    return { value: node.properties[SPAN_ATTRIBUTE_NAME] };
  }

  return undefined;
}

/**
 * Throws when an entry renders an element whose `data-content-span` attribute is not one of
 * `CONTENT_SPANS`, naming the entry, the element, and the value.
 */
export function rehypeContentSpans() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      const spanAttribute = spanAttributeOf(node);

      if (spanAttribute === undefined) {
        return;
      }

      const { value } = spanAttribute;

      if (typeof value !== "string" || !CONTENT_SPAN_NAMES.has(value)) {
        const entryPath = file.path ? `"${toRootRelative(file.path)}"` : "An entry without a path";
        const elementName = elementNameOf(node);
        const writtenElement =
          typeof value === "string"
            ? `\`<${elementName} ${SPAN_ATTRIBUTE_NAME}="${value}">\``
            : `\`<${elementName}>\` with a \`${SPAN_ATTRIBUTE_NAME}\` attribute ${value === null || value === undefined ? "without a value" : "written as an expression"}`;

        throw new Error(`${entryPath} renders ${writtenElement}. Expected one of: ${CONTENT_SPANS.join(", ")}.`);
      }
    });
  };
}
