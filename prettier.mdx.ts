import { createProcessor } from "@mdx-js/mdx";
import { doc, getSupportInfo } from "prettier";

import { ENTRY_SYNTAX_REMARK_PLUGINS } from "./build/content/markup/entry-syntax.ts";
import { estreeOf } from "./build/content/markup/tree.ts";

import type { ContentNode } from "./build/content/markup/tree.ts";
import type { AstPath, Doc, Options, ParserOptions, Plugin, Printer } from "prettier";

// A Prettier plugin that formats MDX from the syntax tree produced by MDX 3. Prettier parses MDX
// as MDX 1, whose elements cannot contain Markdown. This plugin formats Markdown with Prettier's
// Markdown formatter and formats each element's children as Markdown indented between its tags.
// If the formatted MDX parses to a different tree, formatting fails and leaves the file unchanged.
//
// Prettier tracks MDX 2 and 3 support in https://github.com/prettier/prettier/issues/12209. When
// that issue closes, compare Prettier's MDX formatting with this plugin's, and remove the plugin
// if Prettier's keeps the parse tree of the entries in `/content`.
//
// Limitations:
// - Prettier's Markdown formatter treats expressions and inline elements with names or attributes
//   that HTML does not support as Markdown text, which can change them (for example, `{1 *2* 3}`
//   becomes `{1 _2_ 3}`). Markdown blocks containing either, or an element, are therefore printed
//   as authored without wrapping. Expressions on their own lines are also printed as authored.
// - Consecutive images form one paragraph, so they wrap like words and may print on one line. A
//   blank line between images keeps each image on its own line.
// - The comparison ignores front matter and code in languages that Prettier formats, such as a
//   `js` code block, because Prettier reformats them as it does in Markdown.

interface SourceRange {
  start: number;
  end: number;
  startLine: number;
  startColumn: number;
}

type TextToDoc = (text: string, options: Options) => Promise<Doc>;

interface PrintContext {
  originalText: string;
  options: Required<Options>;
  textToDoc: TextToDoc;
  indentationWidth: number;
}

const AST_FORMAT = "mdx-syntax-tree";
const MDX_NODE_TYPES = new Set(["mdxJsxFlowElement", "mdxFlowExpression", "mdxjsEsm", "mdxTextExpression"]);
const ESTREE_LOCATION_KEYS = new Set(["start", "end", "loc", "range", "raw"]);
const WRAPPABLE_STRING_KEYS = new Set(["alt", "title"]);
const HTML_TAG_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;
const COLLAPSIBLE_WHITESPACE_PATTERN = /[ \t\r\n]+/g;

// Prettier's own MDX support formats JSX with these undocumented options: an expression parser, and a root
// marker that prints a `<$>` wrapper's children without it. The tests of formatted tags fail if a Prettier
// upgrade changes them.
const JSX_FORMAT_OPTIONS = { parser: "__js_expression", rootMarker: "mdx" };

const processor = createProcessor({ remarkPlugins: ENTRY_SYNTAX_REMARK_PLUGINS });
const { hardline, indent, join } = doc.builders;
const { languages } = await getSupportInfo();
const printFailures = new WeakMap<ContentNode, unknown>(); // Captures root printing errors that Prettier otherwise discards between `embed` and `print`.

const parse = (text: string): ContentNode => processor.parse(text);

function parseFormatted(formatted: string): ContentNode {
  try {
    return parse(formatted);
  } catch (error) {
    throw new Error(`Formatting produces MDX that fails to parse (${String(error)}).`, { cause: error });
  }
}

function sourceRangeOf({ type, position }: ContentNode): SourceRange {
  const start = position?.start.offset;
  const end = position?.end.offset;

  if (!position || start === undefined || end === undefined) {
    throw new Error(`An MDX \`${type}\` node has no position.`);
  }

  return { start, end, startLine: position.start.line, startColumn: position.start.column };
}

function dedented(text: string, columns: number): string {
  const indentation = new RegExp(`^ {0,${columns}}`);
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? line : line.replace(indentation, "")))
    .join("\n");
}

const sourceOf = (nodes: Array<ContentNode>, originalText: string): string =>
  nodes
    .map((node, index) => {
      const { start, end, startColumn } = sourceRangeOf(node);
      const previous = nodes[index - 1];
      const gap = previous ? originalText.slice(sourceRangeOf(previous).end, start).replace(/[ \t]+$/, "") : "";

      return gap + dedented(originalText.slice(start, end), startColumn - 1);
    })
    .join("");

function isMdxNode(node: ContentNode): boolean {
  if (MDX_NODE_TYPES.has(node.type)) {
    return true;
  }

  if (node.type !== "mdxJsxTextElement") {
    return false;
  }

  return (
    !HTML_TAG_NAME_PATTERN.test(node.name ?? "") ||
    (node.attributes ?? []).some(
      (attribute) =>
        attribute.type !== "mdxJsxAttribute" || (attribute.value !== null && typeof attribute.value !== "string"),
    )
  );
}

const isMarkdownBlock = (node: ContentNode): boolean =>
  !isMdxNode(node) && (node.children ?? []).every(isMarkdownBlock);

const verbatim = (text: string): Doc => join(hardline, text.split("\n"));

// Preserves authored line breaks between sibling nodes, allowing at most one blank line. A blank
// line is never added because MDX treats consecutive paragraph lines as a single paragraph.
function lineBreaksIn(gap: string): Doc {
  const lineBreakCount = gap.split("\n").length - 1;

  if (lineBreakCount === 0) {
    return "";
  }

  return lineBreakCount === 1 ? hardline : [hardline, hardline];
}

// Groups adjacent Markdown blocks so Prettier formats and separates them as it would in a
// Markdown file (e.g., adjacent lists).
function groupsOf(children: Array<ContentNode>): Array<Array<ContentNode>> {
  const groups: Array<Array<ContentNode>> = [];

  for (const child of children) {
    const previousGroup = groups.at(-1);
    const previousChild = previousGroup?.at(-1);

    if (previousGroup && previousChild && isMarkdownBlock(previousChild) && isMarkdownBlock(child)) {
      previousGroup.push(child);
    } else {
      groups.push([child]);
    }
  }

  return groups;
}

// Formats an opening tag as JSX by wrapping it in an empty element.
async function printOpeningTag(openingTag: string, closingTag: string, context: PrintContext): Promise<Doc> {
  const { options, textToDoc, indentationWidth } = context;
  const element = await textToDoc(`<$>${openingTag}${closingTag}</$>`, JSX_FORMAT_OPTIONS);
  const { formatted } = doc.printer.printDocToString(element, {
    ...options,
    printWidth: options.printWidth - indentationWidth + closingTag.length,
  });

  return verbatim(formatted.endsWith(closingTag) ? formatted.slice(0, -closingTag.length) : openingTag);
}

// Prints childless elements as JSX. For elements with children, prints the tags on their own lines
// around indented children.
async function printElement(node: ContentNode, context: PrintContext): Promise<Doc> {
  const { originalText, textToDoc, options, indentationWidth } = context;
  const children = node.children ?? [];
  const [firstChild, lastChild] = [children[0], children.at(-1)];

  if (!firstChild || !lastChild) {
    return textToDoc(`<$>${sourceOf([node], originalText)}</$>`, JSX_FORMAT_OPTIONS);
  }

  const { start, end, startColumn } = sourceRangeOf(node);
  const source = originalText.slice(start, end);
  const childrenStart = sourceRangeOf(firstChild).start - start;
  const childrenEnd = sourceRangeOf(lastChild).end - start;
  const openingTag = source.slice(0, childrenStart).trimEnd();
  const closingTag = source.slice(childrenEnd).trimStart();

  return [
    await printOpeningTag(dedented(openingTag, startColumn - 1), closingTag, context),
    indent([
      hardline,
      await printChildren(children, { ...context, indentationWidth: indentationWidth + options.tabWidth }),
    ]),
    hardline,
    closingTag,
  ];
}

async function printGroup(group: Array<ContentNode>, context: PrintContext): Promise<Doc> {
  const { originalText, textToDoc } = context;
  const [node] = group;

  if (group.length > 1 || (node && isMarkdownBlock(node))) {
    return textToDoc(sourceOf(group, originalText), { parser: "markdown" });
  }

  if (node?.type === "mdxjsEsm") {
    return textToDoc(String(node.value), { parser: "babel" });
  }

  if (node?.type === "mdxJsxFlowElement") {
    return printElement(node, context);
  }

  return verbatim(sourceOf(group, originalText)); // An expression, or a Markdown block containing an element.
}

async function printChildren(children: Array<ContentNode>, context: PrintContext): Promise<Doc> {
  const { originalText } = context;
  const parts: Array<Doc> = [];

  let previousGroup: Array<ContentNode> | undefined;

  for (const group of groupsOf(children)) {
    if (previousGroup) {
      const gapStart = sourceRangeOf(previousGroup.at(-1)!).end;
      const gapEnd = sourceRangeOf(group[0]!).start;

      parts.push(lineBreaksIn(originalText.slice(gapStart, gapEnd)));
    }

    parts.push(await printGroup(group, context));
    previousGroup = group;
  }

  return parts;
}

const isFormattedLanguage = (lang: string): boolean =>
  languages.some(
    ({ name, aliases, extensions }) =>
      name.toLowerCase() === lang || aliases?.includes(lang) || extensions?.includes(`.${lang}`),
  ); // Determines whether Prettier formats a fenced code block for its language.

const estreeWithoutLocations = (estree: unknown): unknown =>
  JSON.parse(JSON.stringify(estree, (key, value: unknown) => (ESTREE_LOCATION_KEYS.has(key) ? undefined : value)));

// Retains only the fields formatting must preserve. Because formatting may rewrap text, whitespace
// collapses in text and inline-code line breaks become spaces, matching Markdown rendering. Because
// JavaScript may be reformatted, expressions and ESM are compared by estree.
function comparable(node: ContentNode): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const estree = estreeOf(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "position" || key === "children") {
      continue;
    }

    if (key === "data") {
      result.estree = estree ? estreeWithoutLocations(estree) : undefined;
    } else if (
      key === "value" &&
      (estree !== null || node.type === "yaml" || (node.type === "code" && node.lang && isFormattedLanguage(node.lang)))
    ) {
      continue;
    } else if (typeof value === "string" && key === "value" && node.type === "text") {
      result[key] = value.replace(COLLAPSIBLE_WHITESPACE_PATTERN, " ");
    } else if (typeof value === "string" && key === "value" && node.type === "inlineCode") {
      result[key] = value.replace(/\r?\n/g, " ");
    } else if (typeof value === "string" && WRAPPABLE_STRING_KEYS.has(key)) {
      result[key] = value.replace(COLLAPSIBLE_WHITESPACE_PATTERN, " ");
    } else if (key === "attributes" && Array.isArray(value)) {
      result[key] = (value as Array<ContentNode>).map(comparable); // Every attribute MDX parses has a `type`.
    } else if (typeof value === "object" && value !== null && "type" in value) {
      result[key] = comparable(value as ContentNode); // An attribute's expression value (e.g., `value={1}`).
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Returns the first node in `original` whose fields or children differ from those in `formatted`.
export function firstDifferenceBetween(original: ContentNode, formatted: ContentNode): ContentNode | undefined {
  const [originalChildren, formattedChildren] = [original.children ?? [], formatted.children ?? []];

  if (
    JSON.stringify(comparable(original)) !== JSON.stringify(comparable(formatted)) ||
    originalChildren.length !== formattedChildren.length
  ) {
    return original;
  }

  for (const [index, child] of originalChildren.entries()) {
    const difference = firstDifferenceBetween(child, formattedChildren[index]!);

    if (difference) {
      return difference;
    }
  }

  return undefined;
}

const mdxPrinter: Printer<ContentNode> = {
  getVisitorKeys: () => [],
  print: (path) => {
    const failure = printFailures.get(path.node);
    throw failure instanceof Error ? failure : new Error("Prettier could not print the MDX.", { cause: failure });
  },
  embed: (path: AstPath<ContentNode>, options) => {
    if (path.node.type !== "root") {
      return null;
    }

    return async (textToDoc) => {
      const root = path.node;

      try {
        const parserOptions = options as Required<ParserOptions<ContentNode>>; // `embed` receives the parser options, which `Printer` types as `Options`.
        const context = {
          originalText: parserOptions.originalText,
          options: parserOptions,
          textToDoc,
          indentationWidth: 0,
        };
        const printed: Doc = [await printChildren(root.children ?? [], context), hardline];
        const { formatted } = doc.printer.printDocToString(printed, parserOptions);
        const difference = firstDifferenceBetween(root, parseFormatted(formatted));

        if (difference) {
          throw new Error(
            `Formatting changes how MDX parses the \`${difference.type}\` at line ${sourceRangeOf(difference).startLine}.`,
          );
        }

        return printed;
      } catch (error) {
        printFailures.set(root, error);
        throw error;
      }
    };
  },
};

export default {
  parsers: {
    mdx: {
      parse,
      astFormat: AST_FORMAT,
      locStart: (node: ContentNode) => sourceRangeOf(node).start,
      locEnd: (node: ContentNode) => sourceRangeOf(node).end,
    },
  },
  printers: { [AST_FORMAT]: mdxPrinter },
} satisfies Plugin<ContentNode>;
