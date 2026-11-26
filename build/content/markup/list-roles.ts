import { visit } from "unist-util-visit";

import { elementNameOf, setMissingAttributes } from "./tree.ts";

import type { ContentNode, ContentParent } from "./tree.ts";

/**
 * Adds `role="list"` to `<ul>` elements in authored JSX and Markdown unless they already have a role.
 *
 * This preserves list semantics in Safari, which removes the implicit list role when native markers are absent (and
 * content styles use `::before` for bullets instead, see `content-body.module.css`).
 */
export function rehypeListRoles() {
  return function transform(tree: ContentParent) {
    visit(tree, (node: ContentNode) => {
      if (elementNameOf(node) === "ul") {
        setMissingAttributes(node, { role: "list" });
      }
    });
  };
}
