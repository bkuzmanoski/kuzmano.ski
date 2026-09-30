import { parsers, printers } from "prettier/plugins/markdown";

import type { AstPath, Plugin, Printer } from "prettier";

// A Prettier plugin keeping inline elements from starting a line in MDX. Prettier's MDX parser
// reads any line that opens with a tag as a block element, which interrupts the paragraph, so a
// wrap that puts `<code>` at the start of a line splits the paragraph on the next format. Prettier
// guards `-`, `+`, `#`, and `1.` the same way, but not `<`.

// Prettier's Markdown AST is untyped; these are the only fields the printer reads.
interface Node {
  type: string;
  children?: Array<Node>;
}

const AST_FORMAT = "mdx-inline-elements";
const INLINE_ELEMENT_TYPES = new Set(["html", "jsx"]);

const markdownPrinter = printers.mdast as Printer<Node>;

function precedesInlineElement(path: AstPath<Node>): boolean {
  const { node, parent, grandparent } = path;

  if (node.type !== "whitespace" || path.next || parent?.type !== "sentence" || !grandparent?.children) {
    return false;
  }

  const following = grandparent.children[grandparent.children.indexOf(parent) + 1];

  return following !== undefined && INLINE_ELEMENT_TYPES.has(following.type);
}

const mdxInlineElementsPrinter: Printer<Node> = {
  ...markdownPrinter,
  print: (path, options, print, args) =>
    precedesInlineElement(path) ? " " : markdownPrinter.print(path, options, print, args),
};

export default {
  parsers: { mdx: { ...parsers.mdx, astFormat: AST_FORMAT } },
  printers: { [AST_FORMAT]: mdxInlineElementsPrinter },
} satisfies Plugin<Node>;
