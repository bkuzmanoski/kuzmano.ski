import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type { ContentNode } from "../content/markup/tree.ts";

const textIn = (node: ContentNode): string => node.value ?? (node.children ?? []).map(textIn).join("");

/** Returns the text of each link in `markdown` as parsed by CommonMark. */
export function linkTextsIn(markdown: string): Array<string> {
  const linkTexts: Array<string> = [];

  // `ContentNode` flattens mdast into optional fields, so the parsed root is cast to it.
  visit(unified().use(remarkParse).parse(markdown) as ContentNode, (node: ContentNode) => {
    if (node.type === "link") {
      linkTexts.push(textIn(node));
    }
  });

  return linkTexts;
}
