import { visit } from "unist-util-visit";

import { CALLOUT_VARIANTS } from "#/features/content/callout-variants.ts";
import type { ContentComponentName } from "#/features/content/content-components.ts";

import { assertAttributeOneOf, isJsxElementNamed } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const CALLOUT_COMPONENT_NAME = "Callout" satisfies ContentComponentName;

/** Throws if an entry renders a `<Callout>` whose `variant` attribute is not one of `CALLOUT_VARIANTS`. */
export function rehypeCalloutVariants() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      if (!isJsxElementNamed(node, CALLOUT_COMPONENT_NAME)) {
        return;
      }

      assertAttributeOneOf(node, "variant", CALLOUT_VARIANTS, {
        file,
        describeElement: (authoredValue) =>
          authoredValue.kind === "string"
            ? `\`Callout\` with the variant "${authoredValue.value}"`
            : `\`Callout\` with the \`variant\` attribute ${authoredValue.kind}`,
      });
    });
  };
}
