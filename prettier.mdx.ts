import { doc } from "prettier";
import { parsers, printers } from "prettier/plugins/markdown";

import type { AstPath, Plugin, Printer } from "prettier";

// A Prettier plugin correcting how Prettier's MDX support formats elements in an entry.

// Prettier's Markdown AST is untyped; these are the only fields the printer reads.
interface Node {
  type: string;
  value?: string;
  children?: Array<Node>;
}

const AST_FORMAT = "mdx";
const INLINE_ELEMENT_TYPES = new Set(["html", "jsx"]);
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(/;
const LEADING_INDENTATION_PATTERN = /^[ \t]*/;

const markdownPrinter = printers.mdast as Printer<Node>;

// In MDX, Prettier treats a line starting with a tag as a block element, which interrupts the
// surrounding paragraph. A wrap before `<code>` therefore splits the paragraph on the next
// format. Prettier avoids this for `-`, `+`, `#`, and `1.`, but not for `<`. Text is split into
// sentences of words and whitespace, followed by the element as a sibling, so the whitespace
// preceding an element is the sentence's final child.
function precedesInlineElement(path: AstPath<Node>): boolean {
  const { node, parent, grandparent } = path;

  if (node.type !== "whitespace" || path.next || parent?.type !== "sentence" || !grandparent?.children) {
    return false;
  }

  const following = grandparent.children[grandparent.children.indexOf(parent) + 1];

  return following !== undefined && INLINE_ELEMENT_TYPES.has(following.type);
}

const mdxPrinter: Printer<Node> = {
  ...markdownPrinter,
  print: (path, options, print, args) =>
    precedesInlineElement(path) ? " " : markdownPrinter.print(path, options, print, args),
  // Prettier treats an element block—from a line beginning with a tag through the next blank line—as
  // JSX. Its JSX formatter fills Markdown as text, merging consecutive image lines, so blocks with
  // Markdown images must print unchanged. It also removes leading indentation retained when a blank
  // line separates the block from its parent element's opening tag.
  embed: (path: AstPath<Node>, options) => {
    const { node } = path;
    const embedded = markdownPrinter.embed?.(path, options) ?? null;

    if (node.type !== "jsx" || typeof embedded !== "function") {
      return embedded;
    }

    if (MARKDOWN_IMAGE_PATTERN.test(node.value ?? "")) {
      return null;
    }

    const indentation = LEADING_INDENTATION_PATTERN.exec(node.value ?? "")?.[0] ?? "";

    return indentation
      ? async (...args) => {
          const embeddedDoc = await embedded(...args);
          return embeddedDoc === undefined
            ? undefined
            : [indentation, doc.builders.align(indentation.length, embeddedDoc)];
        }
      : embedded;
  },
};

export default {
  parsers: { mdx: { ...parsers.mdx, astFormat: AST_FORMAT } },
  printers: { [AST_FORMAT]: mdxPrinter },
} satisfies Plugin<Node>;
