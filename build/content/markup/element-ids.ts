import { visit } from "unist-util-visit";

import { quotedEntryPathOf, stringAttributeOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

/**
 * Throws if two elements in an entry have the same ID.
 *
 * Reads the `id` attribute of HTML elements and of JSX elements authored with a string, which
 * covers heading slugs, footnotes and their references, and IDs the entry writes itself. Must
 * run after the plugins that emit IDs.
 */
export function rehypeElementIds() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    const ids = new Set<string>();
    visit(tree, (node: ContentNode) => {
      const id = stringAttributeOf(node, "id");

      if (id === null) {
        return;
      }

      if (ids.has(id)) {
        throw new Error(`${quotedEntryPathOf(file)} has more than one element with the ID "${id}".`);
      }

      ids.add(id);
    });
  };
}
