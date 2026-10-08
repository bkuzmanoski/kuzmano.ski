import { visit } from "unist-util-visit";

import { CALLOUT_VARIANTS } from "#/lib/content/callout-variants.ts";

import { elementNameOf, isJsxElement, quotedEntryPathOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const CALLOUT_VARIANT_NAMES = new Set<string>(CALLOUT_VARIANTS);

/** Throws if an entry renders a `<Callout>` whose `variant` attribute is not one of `CALLOUT_VARIANTS`. */
export function rehypeCalloutVariants() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node: ContentNode) => {
      if (!isJsxElement(node) || elementNameOf(node) !== "Callout") {
        return;
      }

      const variantAttribute = node.attributes?.find(({ name }) => name === "variant");

      if (variantAttribute === undefined) {
        return;
      }

      const { value } = variantAttribute;

      if (typeof value !== "string" || !CALLOUT_VARIANT_NAMES.has(value)) {
        const writtenVariant =
          typeof value === "string"
            ? `the variant "${value}"`
            : `a \`variant\` attribute ${value === null || value === undefined ? "without a value" : "authored as an expression"}`;
        throw new Error(
          `${quotedEntryPathOf(file)} renders a \`Callout\` with ${writtenVariant}. Expected one of: ${CALLOUT_VARIANTS.join(", ")}.`,
        );
      }
    });
  };
}
