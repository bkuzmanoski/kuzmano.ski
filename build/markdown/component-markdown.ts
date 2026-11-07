import { GITHUB_PROFILE_LINK_TEXT, GITHUB_PROFILE_URL } from "#/config/site.ts";
import { FALLBACK_TEXT_BEFORE_URL } from "#/lib/waitlist/render-fallback.ts";

import { isJsxElement, stringAttributeOf } from "../content/markup/tree.ts";

import { experienceMarkdownNodesFrom } from "./experience.ts";
import { paragraphOf, textNode, textParagraph } from "./nodes.ts";

import type { EntryDataExport } from "./entry-data.ts";
import type { ContentNode } from "../content/markup/tree.ts";

// Fallback Markdown for React components and HTML elements in an entry.

export interface MarkdownContext {
  /** The URL of the entry for components that need to link back to it. */
  url?: string;
  entryDataExportOf: (element: ContentNode) => EntryDataExport;
}

type ComponentReplacement = (node: ContentNode, context: MarkdownContext) => Array<ContentNode>;

export type ComponentMarkdown = (
  { block: ComponentReplacement; inline?: ComponentReplacement } | { block?: undefined; inline: ComponentReplacement }
) & { isRenderedFromEntryData?: boolean };

const strongTextOf = (value: string): ContentNode => ({ type: "strong", children: [textNode(value)] });

const TRAILING_PUNCTUATION_PATTERN = /[.:;?!…]$/;
const ASIDE_MARKDOWN: ComponentMarkdown = {
  block: (node) => {
    const label = stringAttributeOf(node, "label");
    const children = node.children ?? [];

    if (children.length === 0) {
      return []; // Omits the aside too when the Markdown pass omitted every child.
    }

    if (!label) {
      return [{ type: "blockquote", children }];
    }

    const [firstChild, ...otherChildren] = children;

    if (firstChild?.type === "paragraph" && otherChildren.length === 0) {
      const runInLabel = TRAILING_PUNCTUATION_PATTERN.test(label) ? label : `${label}:`;
      return [
        {
          type: "blockquote",
          children: [paragraphOf([strongTextOf(runInLabel), textNode(" "), ...(firstChild.children ?? [])])],
        },
      ];
    }

    return [{ type: "blockquote", children: [paragraphOf([strongTextOf(label)]), ...children] }];
  },
};

const textIn = (node: ContentNode): string => node.value ?? (node.children ?? []).map(textIn).join("");

const INLINE_CODE_MARKDOWN: ComponentMarkdown = {
  inline: (node) => {
    const value = textIn(node);
    return value ? [{ type: "inlineCode", value }] : [];
  },
};

const CAPTIONED_IMAGES_MARKDOWN: ComponentMarkdown = {
  block: (node) => {
    const caption = stringAttributeOf(node, "caption");
    return [...(node.children ?? []), ...(caption ? [textParagraph(caption)] : [])];
  },
};

const waitlistFallbackParagraphFor = (url: string): ContentNode =>
  paragraphOf([textNode(FALLBACK_TEXT_BEFORE_URL), { type: "link", url, children: [textNode(url)] }]);

/** Fallback Markdown for React components embedded in the content, keyed by element name. */
const COMPONENT_MARKDOWN: Record<string, ComponentMarkdown> = {
  Callout: ASIDE_MARKDOWN,
  ContributionGraph: {
    // The graph is rendered from data fetched in the browser, so in Markdown it becomes a GitHub profile link.
    block: () => [
      paragraphOf([{ type: "link", url: GITHUB_PROFILE_URL, children: [textNode(`${GITHUB_PROFILE_LINK_TEXT}.`)] }]),
    ],
  },
  CareerTimeline: {
    isRenderedFromEntryData: true,
    block: (node, { entryDataExportOf }) => {
      const { value, quotedDataFilePath } = entryDataExportOf(node);
      return experienceMarkdownNodesFrom(value, quotedDataFilePath); // Validates the record, throwing if invalid.
    },
  },
  ImageGallery: CAPTIONED_IMAGES_MARKDOWN,
  ImageRow: CAPTIONED_IMAGES_MARKDOWN,
  PrintLink: { block: () => [] }, // Omitted.
  Rail: ASIDE_MARKDOWN,
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

export const componentMarkdownOf = (node: ContentNode): ComponentMarkdown | undefined =>
  isJsxElement(node) && node.name && Object.hasOwn(COMPONENT_MARKDOWN, node.name)
    ? COMPONENT_MARKDOWN[node.name]
    : undefined;

/**
 * Components whose children serve as their Markdown fallback. The build emits those children in place of the component
 * and rejects components absent from both this set and `COMPONENT_MARKDOWN`, preventing unreviewed content from
 * reaching the Markdown output.
 */
export const COMPONENTS_REPLACED_BY_CHILDREN: ReadonlySet<string> = new Set(["AboutHeader", "AlertButton"]);

/** Whether `name` names a React component, which the build checks, instead of an HTML element, which it does not. */
const isComponentName = (name: string) => /^[A-Z]/.test(name);

/** Whether `name` names a component with neither fallback Markdown nor a listing in `componentsReplacedByChildren`. */
export const lacksFallbackMarkdown = (name: string, componentsReplacedByChildren: ReadonlySet<string>) =>
  isComponentName(name) && !Object.hasOwn(COMPONENT_MARKDOWN, name) && !componentsReplacedByChildren.has(name);
