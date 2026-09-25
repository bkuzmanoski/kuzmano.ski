import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { CONTINUE, EXIT, SKIP, visit } from "unist-util-visit";

import { GITHUB_PROFILE_LINK_TEXT, GITHUB_PROFILE_URL } from "#/config/site.ts";
import { FALLBACK_TEXT_BEFORE_URL } from "#/lib/waitlist/render-fallback.ts";
import { canonicalUrl } from "#/site/metadata.ts";

import { remarkGfmSubset } from "../content/markup/gfm.ts";
import { NO_MEDIA_FOR_ENTRY, remarkMedia } from "../content/markup/media-rewrite.ts";
import {
  JSX_ELEMENT_NODE_TYPES,
  elementNameOf,
  estreeOf,
  isJsxElement,
  stringAttributeOf,
} from "../content/markup/tree.ts";

import { readEntryDataExports } from "./entry-data.ts";
import { experienceMarkdownNodesFrom } from "./experience.ts";
import { remarkAuthoredLists } from "./lists.ts";
import { MARKDOWN_SERIALIZER_OPTIONS, paragraphOf, quotedEntryPathOf, textNode, textParagraph } from "./nodes.ts";
import { remarkAuthoredTables } from "./tables.ts";

import type { EntryDataExport, EntryDataModuleReader } from "./entry-data.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";
import type { ContentNode, ContentParent, EntryVFile } from "../content/markup/tree.ts";

// Converts an entry's MDX source to the Markdown representation a reader is served at its `.md` URL.

export interface MarkdownEntry {
  path?: string;
  url?: string; // The entry's URL, for a component that needs to link back to it.
  readEntryDataModule?: EntryDataModuleReader; // Called only for an entry that renders a component rendered from entry data.
}

/** Converts an entry's MDX source to its Markdown representation. */
export type MarkdownRenderer = (source: string, entry?: MarkdownEntry) => Promise<string>;

// What the transforms read from each entry's file, since it differs between entries rendered by the
// same processor. `entryDataExports` is written by `readEntryData`.
interface MarkdownFileData extends Pick<MarkdownEntry, "url" | "readEntryDataModule"> {
  entryDataExports?: Map<ContentNode, EntryDataExport>;
}

interface MarkdownVFile extends EntryVFile {
  data: Record<string, unknown>;
}

interface MarkdownContext {
  url?: string; // The entry's URL, for a component that needs to link back to it.
  entryDataExportOf: (element: ContentNode) => EntryDataExport;
}

type ComponentReplacement = (node: ContentNode, context: MarkdownContext) => Array<ContentNode>;
type ComponentMarkdown = (
  { block: ComponentReplacement; inline?: ComponentReplacement } | { block?: undefined; inline: ComponentReplacement }
) & { isRenderedFromEntryData?: boolean };

const strongLabelOf = (node: ContentNode): ContentNode | null => {
  const label = stringAttributeOf(node, "label");
  return label ? { type: "strong", children: [textNode(label)] } : null;
};

const LABELED_ASIDE_MARKDOWN: ComponentMarkdown = {
  block: (node) => {
    const strongLabel = strongLabelOf(node);
    return [...(strongLabel ? [paragraphOf([strongLabel])] : []), ...(node.children ?? [])];
  },
  inline: (node) => {
    const strongLabel = strongLabelOf(node);
    return [...(strongLabel ? [strongLabel, textNode(" ")] : []), ...(node.children ?? [])];
  },
};

const textIn = (node: ContentNode): string => node.value ?? (node.children ?? []).map(textIn).join("");

const INLINE_CODE_MARKDOWN: ComponentMarkdown = {
  inline: (node) => {
    const value = textIn(node);
    return value ? [{ type: "inlineCode", value }] : [];
  },
};

const waitlistFallbackParagraphFor = (url: string): ContentNode =>
  paragraphOf([textNode(FALLBACK_TEXT_BEFORE_URL), { type: "link", url, children: [textNode(url)] }]);

// Fallback Markdown for React components embedded in the content, keyed by element name.
// A component without fallback Markdown is replaced by its children.
const COMPONENT_MARKDOWN: Record<string, ComponentMarkdown> = {
  Callout: LABELED_ASIDE_MARKDOWN,
  ContributionGraph: {
    // The graph is drawn from data fetched in the browser, so in Markdown it becomes a GitHub profile link.
    block: () => [
      paragraphOf([{ type: "link", url: GITHUB_PROFILE_URL, children: [textNode(GITHUB_PROFILE_LINK_TEXT)] }]),
    ],
  },
  CareerTimeline: {
    isRenderedFromEntryData: true,
    block: (node, { entryDataExportOf }) => {
      const { value, quotedDataFilePath } = entryDataExportOf(node);
      return experienceMarkdownNodesFrom(value, quotedDataFilePath); // Validates the record, throwing if invalid.
    },
  },
  ImageGrid: {
    block: (node) => {
      const caption = stringAttributeOf(node, "caption");
      return [...(node.children ?? []), ...(caption ? [textParagraph(caption)] : [])];
    },
  },
  Rail: LABELED_ASIDE_MARKDOWN,
  Waitlist: { block: (node, { url }) => (url ? [...(node.children ?? []), waitlistFallbackParagraphFor(url)] : []) },
  blockquote: {
    // Markdown cannot quote inside a sentence, so a quotation is replaced by its children.
    block: (node) => [{ type: "blockquote", children: node.children ?? [] }],
    inline: (node) => node.children ?? [],
  },
  code: INLINE_CODE_MARKDOWN,
  hr: { block: () => [{ type: "thematicBreak" }] },
  kbd: INLINE_CODE_MARKDOWN,
  img: {
    // A `<picture>` is replaced by its children, which keeps its `<img>` and drops its `<source>` elements.
    // `remarkMedia` has already rewritten the `src` attribute to an absolute media URL.
    inline: (node) => {
      const url = stringAttributeOf(node, "src");
      return url ? [{ type: "image", url, alt: stringAttributeOf(node, "alt") ?? "" }] : [];
    },
  },
  video: {
    // Markdown has no video element, so a video becomes a link to its file. The link contains the poster image, with
    // the video's `aria-label` as its alternative text, or the `aria-label` alone for a video without a poster image.
    inline: (node) => {
      const url = stringAttributeOf(node, "src");
      const poster = stringAttributeOf(node, "poster");
      const label = stringAttributeOf(node, "aria-label");

      if (!url) {
        return [];
      }

      return [
        {
          type: "link",
          url,
          children: poster ? [{ type: "image", url: poster, alt: label ?? "" }] : [textNode(label ?? url)],
        },
      ];
    },
  },
};

const componentMarkdownOf = (node: ContentNode): ComponentMarkdown | undefined =>
  isJsxElement(node) && node.name && Object.hasOwn(COMPONENT_MARKDOWN, node.name)
    ? COMPONENT_MARKDOWN[node.name]
    : undefined;

// Nodes that exist only to serve the compiled component: imports, exports, and `{expressions}` other
// than a literal, which `replaceLiteralExpressions` has already replaced with its text.
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
      blocks.push(...trimmedParagraphsOf(phrasing), {
        ...child,
        type: "mdxJsxFlowElement",
        children: trimmedParagraphsOf(child.children ?? []),
      });
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

// Replaces each literal `{expression}` with the text it renders, such as `{"⌘"}` in a `<kbd>` or
// `{"{"}` in a table cell, where MDX would otherwise parse the character itself as syntax. An
// expression written as a block becomes a paragraph. This runs before the transforms that read the
// text of an inline code element or a table cell, and after `replacePreformattedElements`, which
// reads the text of the expressions in a `<pre>` itself so that it can separate them by lines rather
// than paragraphs.
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

// Replaces each `<pre>` with a fenced code block of its text. This runs before `stripMdx`, which would
// replace the `<code>` inside it with an inline code span and join its lines.
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

function splitBlockElements() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (
        node.type !== "paragraph" ||
        !parent ||
        index === undefined ||
        !node.children?.some(isBlockElementInParagraph)
      ) {
        return undefined;
      }

      parent.children.splice(index, 1, ...paragraphSplitAtBlockElements(node));

      return index;
    });
  };
}

/** The name of every component with block fallback Markdown that is written inside a sentence in `tree`. */
function blockFallbacksWrittenInlineIn(tree: ContentNode): Set<string> {
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

// Ensures no component whose fallback Markdown is a block was written inside a sentence, where its
// replacement would be serialized into the prose around it rather than as a block of its own.
function assertBlockFallbacks() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const writtenInline = blockFallbacksWrittenInlineIn(tree);

    if (writtenInline.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} writes components inline whose fallback Markdown is a block: ${[...writtenInline].join(", ")}.`,
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

    // A component written as a block with only an inline fallback produces phrasing where a block is
    // expected. `remark-stringify` cannot separate it from the following block, collapsing the
    // document onto one line, so it is wrapped in a paragraph.
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

// Replaces MDX nodes with plain Markdown nodes that `remark-stringify` can serialize.
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

    // `visit` visits parents before their descendants, so reversing this list processes children
    // first. This ensures a component promoted in place of its parent is already replaced, rather
    // than leaving nested MDX behind.
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

// Ensures the Markdown tree contains no MDX nodes. Any MDX that survives `stripMdx`
// would be serialized as JSX and appear verbatim in the Markdown.
function assertMarkdownOnly() {
  return function assert(tree: ContentNode, file: EntryVFile) {
    const remainingMdxNodeTypes = mdxNodeTypesIn(tree);

    if (remainingMdxNodeTypes.size > 0) {
      throw new Error(
        `${quotedEntryPathOf(file)} still contains MDX that cannot be written as Markdown: ${[...remainingMdxNodeTypes].join(", ")}.`,
      );
    }
  };
}

/**
 * Returns a renderer that converts an entry's MDX source to its Markdown representation, resolving the
 * entry's media through `mediaForEntry`.
 */
export function markdownRendererFor(mediaForEntry: MediaForEntry = NO_MEDIA_FOR_ENTRY): MarkdownRenderer {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter) // Keeps the frontmatter block which contains the title, description, and date.
    .use(remarkMdx)
    .use(remarkGfmSubset)
    .use(splitBlockElements)
    .use(assertBlockFallbacks)
    .use(replacePreformattedElements)
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
