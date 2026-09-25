import { elementNameOf, hasAttribute, setMissingAttributes } from "./tree.ts";

import type { ContentParent } from "./tree.ts";

/**
 * Numbers the `<h2>`, `<figure>`, and `<table>` elements that are direct children of an entry's root,
 * each kind counted from 1, as `data-section-number`, `data-figure-number`, and `data-table-number`.
 *
 * A figure marked `data-content-unnumbered` is not numbered, and a table inside a figure is not a
 * child of the root, so neither is counted. A section number is zero-padded to two digits, as
 * `decimal-leading-zero` is. Only what the entry writes is numbered, so an element a component renders
 * at the root has no label.
 */
export function rehypeNumberedElements() {
  return function transform(tree: ContentParent) {
    let sectionCount = 0;
    let figureCount = 0;
    let tableCount = 0;

    for (const node of tree.children) {
      switch (elementNameOf(node)) {
        case "h2":
          setMissingAttributes(node, { "data-section-number": String(++sectionCount).padStart(2, "0") });
          break;
        case "figure":
          if (!hasAttribute(node, "data-content-unnumbered")) {
            setMissingAttributes(node, { "data-figure-number": String(++figureCount) });
          }
          break;
        case "table":
          setMissingAttributes(node, { "data-table-number": String(++tableCount) });
          break;
      }
    }
  };
}
