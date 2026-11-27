import { visit } from "unist-util-visit";

import { CONTENT_SPANS } from "#/features/content/content-spans.ts";

import { assertAttributeOneOf, elementNameOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const SPAN_ATTRIBUTE_NAME = "data-content-span";

/**
 * Throws if an entry renders an element with a `data-content-span` attribute outside `CONTENT_SPANS`. Checks both
 * authored JSX and hast elements (including `<picture>` wrappers that received an `<img>`'s layout attributes).
 */
export function rehypeContentSpans() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      const elementName = elementNameOf(node);
      assertAttributeOneOf(node, SPAN_ATTRIBUTE_NAME, CONTENT_SPANS, {
        file,
        describeElement: (authoredValue) =>
          authoredValue.kind === "string"
            ? `\`<${elementName} ${SPAN_ATTRIBUTE_NAME}="${authoredValue.value}">\``
            : `\`<${elementName}>\` with the \`${SPAN_ATTRIBUTE_NAME}\` attribute ${authoredValue.kind}`,
      });
    });
  };
}
