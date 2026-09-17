import { visit } from "unist-util-visit";

import { elementNameOf, isJsxElement } from "./tree.ts";

import type { ContentNode, ContentParent } from "./tree.ts";

interface MarkedContentNode extends ContentNode {
  data?: { _mdxExplicitJsx?: boolean | null };
}

/**
 * Allows specified authored JSX elements to resolve through the MDX component provider.
 *
 * MDX marks JSX elements as explicit, which bypasses the provider. Removing that mark
 * enables provider components, such as a custom `<video>`, while preserving the authored
 * element when no provider component exists.
 *
 * Run after `rehypeMedia`, which reads and rewrites element attributes.
 */
export function rehypeProvidedElements(names: Array<string>) {
  const providedNames = new Set(names);
  return function transform(tree: ContentParent) {
    visit(tree, (node: MarkedContentNode) => {
      const name = elementNameOf(node);

      if (isJsxElement(node) && name !== null && providedNames.has(name) && node.data) {
        delete node.data._mdxExplicitJsx;
      }
    });
  };
}
