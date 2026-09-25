import { visit } from "unist-util-visit";

import { CALLOUT_VARIANTS } from "#/lib/content/callout-variants.ts";

import { toRootRelative } from "../../paths.ts";

import { elementNameOf, isJsxElement } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

const CALLOUT_VARIANT_NAMES = new Set<string>(CALLOUT_VARIANTS);

/**
 * Throws when an entry renders a `<Callout>` whose `variant` attribute is not one of
 * `CALLOUT_VARIANTS`, naming the entry and the value.
 */
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
        const entryPath = file.path ? `"${toRootRelative(file.path)}"` : "An entry without a path";
        const writtenVariant =
          typeof value === "string"
            ? `the variant "${value}"`
            : `a \`variant\` attribute ${value === null || value === undefined ? "without a value" : "written as an expression"}`;

        throw new Error(
          `${entryPath} renders a \`Callout\` with ${writtenVariant}. Expected one of: ${CALLOUT_VARIANTS.join(", ")}.`,
        );
      }
    });
  };
}
