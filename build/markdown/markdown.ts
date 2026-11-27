import remarkStringify from "remark-stringify";
import { CONTINUE, EXIT, SKIP, visit } from "unist-util-visit";

import { GITHUB_GIST_LINK_TEXT } from "#/config/site.ts";
import { githubGistUrlOf } from "#/site/github-gists.ts";
import { canonicalUrl } from "#/site/metadata.ts";

import { codeFenceAttributesIn } from "../content/markup/code-fence-attributes.ts";
import { entryParser } from "../content/markup/entry-syntax.ts";
import { NO_MEDIA_FOR_ENTRY, remarkMedia } from "../content/markup/media-rewrite.ts";
import {
  JSX_ELEMENT_NODE_TYPES,
  elementNameOf,
  estreeOf,
  isJsxElement,
  quotedEntryPathOf,
  stringAttributeOf,
} from "../content/markup/tree.ts";

import { COMPONENTS_REPLACED_BY_CHILDREN, componentMarkdownOf, lacksFallbackMarkdown } from "./component-markdown.ts";
import { readEntryDataExports } from "./entry-data.ts";
import { remarkAuthoredLists } from "./lists.ts";
import { MARKDOWN_SERIALIZER_OPTIONS, paragraphOf, textNode, textParagraph } from "./nodes.ts";
import { remarkAuthoredTables } from "./tables.ts";

import type { MarkdownContext } from "./component-markdown.ts";
import type { EntryDataExport, EntryDataModuleReader } from "./entry-data.ts";
import type { CodeFenceAttributeName } from "../content/markup/code-fence-attributes.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { ContentNode, ContentParent, EntryVFile } from "../content/markup/tree.ts";

// Converts an entry's MDX source to the Markdown representation a user is served at its `.md` URL.

export interface MarkdownEntry {
  path?: string;
  /** The entry's URL, used by components that link back to it. */
  url?: string;
  /** Called only for an entry that renders a component rendered from entry data. */
  readEntryDataModule?: EntryDataModuleReader;
}

/** Converts an entry's MDX source to its Markdown representation. */
export type MarkdownRenderer = (source: string, entry?: MarkdownEntry) => Promise<string>;

// Per-entry data shared across transforms on the same processor; `readEntryData` populates `entryDataExports`.
interface MarkdownFileData extends Pick<MarkdownEntry, "url" | "readEntryDataModule"> {
  entryDataExports?: Map<ContentNode, EntryDataExport>;
}

interface MarkdownVFile extends EntryVFile {
  data: Record<string, unknown>;
}

// MDX nodes used only by compiled components (imports, exports, and non-literal expressions after
// `replaceLiteralExpressions`).
const EXPRESSION_NODE_TYPES = new Set(["mdxFlowExpression", "mdxTextExpression"]);
const DISCARDED_NODE_TYPES = new Set(["mdxjsEsm", ...EXPRESSION_NODE_TYPES]);
const MDX_NODE_TYPES = new Set([...DISCARDED_NODE_TYPES, ...JSX_ELEMENT_NODE_TYPES]);

const BLOCK_ELEMENT_NAMES = new Set([
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "figcaption",
  "figure",
  "hr",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

const isBlockElementInParagraph = (node: ContentNode) =>
  node.type === "mdxJsxTextElement" && BLOCK_ELEMENT_NAMES.has(node.name ?? "");

// Matches a paragraph containing only a block-fallback JSX element so it renders as a block (matching MDX unwrapping).
function soleBlockComponentIn(paragraph: ContentNode): ContentNode | undefined {
  const renderedChildren = (paragraph.children ?? []).filter((child) => child.type !== "text" || child.value?.trim());
  const [onlyChild, ...otherChildren] = renderedChildren;

  return onlyChild?.type === "mdxJsxTextElement" &&
    otherChildren.length === 0 &&
    componentMarkdownOf(onlyChild)?.block !== undefined
    ? onlyChild
    : undefined;
}

const flowElementOf = (textElement: ContentNode): ContentNode => ({
  ...textElement,
  type: "mdxJsxFlowElement",
  children: trimmedParagraphsOf(textElement.children ?? []),
});

function trimmedParagraphsOf(phrasing: Array<ContentNode>): Array<ContentNode> {
  const children = phrasing
    .map((node, index) => {
      if (node.type !== "text") {
        return node;
      }

      const value = node.value ?? "";
      const trimmedStart = index === 0 ? value.trimStart() : value;
      return { ...node, value: index === phrasing.length - 1 ? trimmedStart.trimEnd() : trimmedStart };
    })
    .filter((node) => node.type !== "text" || node.value);

  return children.length > 0 ? [paragraphOf(children)] : [];
}

function paragraphSplitAtBlockElements(paragraph: ContentNode): Array<ContentNode> {
  const blocks: Array<ContentNode> = [];
  let phrasing: Array<ContentNode> = [];

  for (const child of paragraph.children ?? []) {
    if (isBlockElementInParagraph(child)) {
      blocks.push(...trimmedParagraphsOf(phrasing), flowElementOf(child));
      phrasing = [];
    } else {
      phrasing.push(child);
    }
  }

  return [...blocks, ...trimmedParagraphsOf(phrasing)];
}

function literalTextOf(expression: ContentNode): string | null {
  const [statement, ...otherStatements] = estreeOf(expression)?.body ?? [];
  const value = statement?.type === "ExpressionStatement" && otherStatements.length === 0 ? statement.expression : null;

  if (value?.type === "Literal") {
    return typeof value.value === "string" || typeof value.value === "number" ? String(value.value) : null;
  }

  const [quasi, ...otherQuasis] = value?.type === "TemplateLiteral" ? (value.quasis ?? []) : [];
  const cooked = (quasi?.value as { cooked?: unknown } | undefined)?.cooked;

  return otherQuasis.length === 0 && typeof cooked === "string" ? cooked : null;
}

// Replaces literal `{expression}` nodes with their rendered text (block expressions become paragraphs). Runs after
// `replacePreformattedElements` (so `<pre>` keeps line breaks) and before inline-code and table transforms.
function replaceLiteralExpressions() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (!EXPRESSION_NODE_TYPES.has(node.type) || !parent || index === undefined) {
        return CONTINUE;
      }

      const literalText = literalTextOf(node);

      if (literalText !== null) {
        parent.children[index] = node.type === "mdxTextExpression" ? textNode(literalText) : textParagraph(literalText);
      }

      return SKIP;
    });
  };
}

const isFlowChildOfPreformattedText = ({ type }: ContentNode) => type === "paragraph" || type === "mdxFlowExpression";

function preformattedTextSeparatorBetween(previous: ContentNode, next: ContentNode): string {
  if (previous.type === "paragraph" && next.type === "paragraph") {
    return "\n\n";
  }

  return isFlowChildOfPreformattedText(previous) || isFlowChildOfPreformattedText(next) ? "\n" : "";
}

function preformattedTextIn(node: ContentNode): string {
  if (EXPRESSION_NODE_TYPES.has(node.type)) {
    return literalTextOf(node) ?? "";
  }

  if (DISCARDED_NODE_TYPES.has(node.type)) {
    return "";
  }

  const children = node.children ?? [];

  return (
    node.value ??
    children
      .map((child, index) => {
        const previous = children[index - 1];
        return `${previous ? preformattedTextSeparatorBetween(previous, child) : ""}${preformattedTextIn(child)}`;
      })
      .join("")
  );
}

const LANGUAGE_CLASS_NAME_PATTERN = /(?:^|\s)language-(\S+)/;

function codeLanguageIn(pre: ContentNode): string | null {
  let language: string | null = null;

  visit(pre, (node) => {
    if (elementNameOf(node) !== "code") {
      return CONTINUE;
    }

    const className = stringAttributeOf(node, "className") ?? stringAttributeOf(node, "class") ?? "";

    language = LANGUAGE_CLASS_NAME_PATTERN.exec(className)?.[1] ?? null;

    return EXIT;
  });

  return language;
}

// Replaces each `<pre>` with a fenced code block before `stripMdx` would collapse its `<code>` into an inline span.
function replacePreformattedElements() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (node.type !== "mdxJsxFlowElement" || node.name !== "pre" || !parent || index === undefined) {
        return CONTINUE;
      }

      parent.children.splice(index, 1, { type: "code", lang: codeLanguageIn(node), value: preformattedTextIn(node) });

      return SKIP;
    });
  };
}

// Blocks emitted before a code fence for each supported attribute (see
// `/build/content/markup/code-fence-attributes.ts`).
const CODE_FENCE_ATTRIBUTE_MARKDOWN: Record<CodeFenceAttributeName, (value: string) => Array<ContentNode>> = {
  gist: (gistId) => [
    paragraphOf([{ type: "link", url: githubGistUrlOf(gistId), children: [textNode(`${GITHUB_GIST_LINK_TEXT}.`)] }]),
  ],
};

// Replaces each code fence's meta string with the Markdown blocks for its attributes.
function replaceCodeFenceAttributes() {
  return function transform(tree: ContentParent, file: EntryVFile) {
    visit(tree, (node, index, parent) => {
      if (node.type !== "code" || !parent || index === undefined) {
        return CONTINUE;
      }

      const blocksBeforeFence = [...codeFenceAttributesIn(node.meta, file)].flatMap(([name, value]) =>
        CODE_FENCE_ATTRIBUTE_MARKDOWN[name](value),
      );

      node.meta = null;
      parent.children.splice(index, 0, ...blocksBeforeFence);

      return index + blocksBeforeFence.length + 1; // Continues after the inserted blocks and the fence.
    });
  };
}

function splitBlockElements() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (node.type !== "paragraph" || !parent || index === undefined) {
        return undefined;
      }

      const blockFallback = soleBlockComponentIn(node);

      if (blockFallback) {
        parent.children.splice(index, 1, flowElementOf(blockFallback));
      } else if (node.children?.some(isBlockElementInParagraph)) {
        parent.children.splice(index, 1, ...paragraphSplitAtBlockElements(node));
      } else {
        return undefined;
      }

      return index;
    });
  };
}

// Returns names of block-fallback components authored inline inside a sentence in `tree`.
function blockFallbacksAuthoredInlineIn(tree: ContentNode): Set<string> {
  const componentNames = new Set<string>();

  visit(tree, (node) => {
    if (node.type !== "mdxJsxTextElement" || !node.name) {
      return;
    }

    const componentMarkdown = componentMarkdownOf(node);

    if (componentMarkdown && !componentMarkdown.inline) {
      componentNames.add(node.name);
    }
  });

  return componentNames;
}

// Throws if a block-fallback component is authored inline inside a sentence, where it cannot serialize as a block.
function assertBlockFallbacks() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const authoredInline = blockFallbacksAuthoredInlineIn(tree);

    if (authoredInline.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} renders ${[...authoredInline].map((name) => `\`${name}\``).join(", ")} inside a sentence. Expected a component with a block as its fallback Markdown in a paragraph of its own.`,
      );
    }
  };
}

function assertComponentFallbacks(componentsReplacedByChildren: ReadonlySet<string>) {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const componentNames = new Set<string>();

    visit(tree, (node) => {
      if (isJsxElement(node) && node.name && lacksFallbackMarkdown(node.name, componentsReplacedByChildren)) {
        componentNames.add(node.name);
      }
    });

    if (componentNames.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} renders ${[...componentNames].map((name) => `\`${name}\``).join(", ")} without fallback Markdown. Expected a component in \`CONTENT_COMPONENTS\` in \`src/features/content/content-components.ts\`.`,
      );
    }
  };
}

function replacementsFor(node: ContentNode, context: MarkdownContext): Array<ContentNode> {
  if (DISCARDED_NODE_TYPES.has(node.type)) {
    return [];
  }

  if (isJsxElement(node)) {
    const componentMarkdown = componentMarkdownOf(node);

    if (!componentMarkdown) {
      return node.children ?? [];
    }

    if (node.type === "mdxJsxTextElement" && componentMarkdown.inline) {
      return componentMarkdown.inline(node, context);
    }

    if (componentMarkdown.block) {
      return componentMarkdown.block(node, context);
    }

    // A component authored as a block with only an inline fallback produces phrasing where a block is expected.
    // `remark-stringify` cannot separate it from the following block, collapsing the document onto one line, so it is
    // wrapped in a paragraph.
    return [paragraphOf(componentMarkdown.inline(node, context))];
  }

  return [node];
}

const markdownFileDataOf = (file: MarkdownVFile) => file.data as MarkdownFileData;

function readEntryData() {
  return async function transform(tree: ContentNode, file: MarkdownVFile) {
    const elements: Array<ContentNode> = [];

    visit(tree, (node) => {
      if (componentMarkdownOf(node)?.isRenderedFromEntryData) {
        elements.push(node);
      }
    });

    const fileData = markdownFileDataOf(file);

    fileData.entryDataExports = await readEntryDataExports(tree, elements, file, fileData.readEntryDataModule);
  };
}

// Replaces MDX nodes with plain Markdown nodes for `remark-stringify`.
function stripMdx() {
  return function transform(tree: ContentNode, file: MarkdownVFile) {
    const { url, entryDataExports } = markdownFileDataOf(file);
    const context: MarkdownContext = {
      url,
      entryDataExportOf: (element) => {
        const entryDataExport = entryDataExports?.get(element);

        if (!entryDataExport) {
          throw new Error(`${quotedEntryPathOf(file)} renders \`${element.name}\` before its entry data was read.`);
        }

        return entryDataExport;
      },
    };
    const visitedNodes: Array<ContentNode> = [];

    visit(tree, (node) => {
      visitedNodes.push(node);
    });

    // `visit` visits parents before their descendants, so reversing this list processes children first. This ensures a
    // component promoted in place of its parent is already replaced, rather than leaving nested MDX behind.
    for (const node of visitedNodes.reverse()) {
      if (node.children) {
        node.children = node.children.flatMap((child) => replacementsFor(child, context));
      }
    }
  };
}

function mdxNodeTypesIn(tree: ContentNode): Set<string> {
  const mdxNodeTypes = new Set<string>();

  visit(tree, (node) => {
    if (MDX_NODE_TYPES.has(node.type)) {
      mdxNodeTypes.add(node.name ?? node.type);
    }
  });

  return mdxNodeTypes;
}

// Fails if any MDX nodes survive `stripMdx`, preventing `remark-stringify` from emitting verbatim JSX.
function assertMarkdownOnly() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const remainingMdxNodeTypes = mdxNodeTypesIn(tree);

    if (remainingMdxNodeTypes.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} still contains MDX that cannot be emitted as Markdown: ${[...remainingMdxNodeTypes].join(", ")}.`,
      );
    }
  };
}

/**
 * Returns a renderer that converts an entry's MDX source to its Markdown representation, resolving the entry's media
 * through `mediaForEntry`.
 */
export function markdownRendererFor({
  mediaForEntry = NO_MEDIA_FOR_ENTRY,
  componentsReplacedByChildren = COMPONENTS_REPLACED_BY_CHILDREN,
}: { mediaForEntry?: MediaForEntry; componentsReplacedByChildren?: ReadonlySet<string> } = {}): MarkdownRenderer {
  const processor = entryParser() // Keeps the frontmatter block that contains the title, description, and date.
    .use(splitBlockElements)
    .use(assertBlockFallbacks)
    .use(assertComponentFallbacks, componentsReplacedByChildren)
    .use(replacePreformattedElements)
    .use(replaceCodeFenceAttributes)
    .use(replaceLiteralExpressions)
    .use(remarkMedia, mediaForEntry, canonicalUrl) // Resolve media URLs before stripping MDX so the fallback Markdown uses them.
    .use(remarkAuthoredTables)
    .use(remarkAuthoredLists)
    .use(readEntryData)
    .use(stripMdx)
    .use(assertMarkdownOnly)
    .use(remarkStringify, MARKDOWN_SERIALIZER_OPTIONS)
    .freeze();

  return async (source, { path, url, readEntryDataModule } = {}) =>
    String(
      await processor.process({ value: source, path, data: { url, readEntryDataModule } satisfies MarkdownFileData }),
    );
}
