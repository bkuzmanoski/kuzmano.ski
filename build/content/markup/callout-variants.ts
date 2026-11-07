import { visit } from "unist-util-visit";

import { CALLOUT_VARIANTS } from "#/lib/content/callout-variants.ts";

import { assertAttributeOneOf, isJsxElementNamed } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

/** Throws if an entry renders a `<Callout>` whose `variant` attribute is not one of `CALLOUT_VARIANTS`. */
export function rehypeCalloutVariants() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      if (!isJsxElementNamed(node, "Callout")) {
        return;
      }

      assertAttributeOneOf(node, "variant", CALLOUT_VARIANTS, {
        file,
        describeElement: (authoredValue) =>
          authoredValue.kind === "string"
            ? `a \`Callout\` with the variant "${authoredValue.value}"`
            : `a \`Callout\` with a \`variant\` attribute ${authoredValue.kind}`,
      });
    });
  };
}
