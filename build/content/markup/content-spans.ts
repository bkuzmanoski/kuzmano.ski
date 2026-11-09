import { visit } from "unist-util-visit";

import { CONTENT_SPANS } from "#/features/content/content-spans.ts";

import { assertAttributeOneOf, elementNameOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const SPAN_ATTRIBUTE_NAME = "data-content-span";

/**
 * Throws if an entry renders an element whose `data-content-span` attribute is not one of `CONTENT_SPANS`. Checks
 * authored JSX and hast elements, such as the `<picture>` that `rehypeMedia` moves an authored `<img>`'s layout
 * attributes to.
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
