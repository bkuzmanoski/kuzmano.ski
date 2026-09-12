import { fromHtml } from "hast-util-from-html";
import { defaultSchema, sanitize } from "hast-util-sanitize";
import { selectAll } from "hast-util-select";
import { toHtml } from "hast-util-to-html";
import { parseSrcset, stringifySrcset } from "srcset";
import { CONTINUE, SKIP, visit } from "unist-util-visit";

import type { Element, ElementContent } from "hast";
import type { Schema } from "hast-util-sanitize";

const FEED_SCHEMA: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "article", // Keeps the entry as one element instead of unwrapping it into a list of nodes.
    "figure",
    "figcaption",
    "caption",
    "abbr",
    "cite",
    "mark",
    "time",
    "audio",
    "video",
    "track",
  ],
  strip: ["script", "style", "svg", "button", "form", "input", "select", "textarea", "object", "iframe", "template"],
  attributes: {
    ...defaultSchema.attributes,
    "*": (defaultSchema.attributes?.["*"] ?? []).filter((attribute) => attribute !== "tabIndex"),
    source: [...(defaultSchema.attributes?.source ?? []), "src", "type"],
    video: ["ariaLabel", "controls", "height", "loop", "muted", "playsInline", "poster", "preload", "src", "width"],
    audio: ["controls", "loop", "muted", "preload", "src"],
    track: ["default", "kind", "src", "srcLang"],
  },
  clobber: [],
};
const WRAPPER_TAGS = new Set(["span", "div"]);

// Properties containing URLs relative to the entry, by their hast names.
const URL_PROPERTIES = ["src", "poster", "href"];
const URL_LIST_PROPERTIES = ["srcSet"];

const paragraph = (value: string): Element => ({
  type: "element",
  tagName: "p",
  properties: {},
  children: [{ type: "text", value }],
});

// Rewrites markup for output in a feed.
//
// Components can use the following attributes to control how their markup is rendered:
//
// - `data-feed-omit` removes the element entirely
// - `data-feed-text` replaces the element with a paragraph containing text supplied by the component
function replaceUIMarkup(article: Element) {
  visit(article, "element", (element, index, parent) => {
    if (!parent || index === undefined) {
      return CONTINUE; // The article itself, which is the tree being visited rather than a node in it.
    }

    if ("dataHeadingLink" in element.properties || "dataFeedOmit" in element.properties) {
      parent.children.splice(index, 1);
      return index; // Continues at the sibling that took the removed element's place.
    }

    const fallbackText = element.properties.dataFeedText;

    if (typeof fallbackText === "string") {
      parent.children[index] = paragraph(fallbackText);
      return SKIP; // The paragraph replaces the element's children as well as the element.
    }

    return CONTINUE;
  });
}

// Sanitizing removes the attributes from the wrappers used for syntax highlighting
// and UI, leaving elements that contain nothing but their children.
//
// A wrapper is replaced by its own children, so this returns a new list of nodes rather than
// visiting the tree in place.
function unwrapPlainWrappers(children: Array<ElementContent>): Array<ElementContent> {
  return children.flatMap((child) => {
    if (child.type !== "element") {
      return [child];
    }

    child.children = unwrapPlainWrappers(child.children);

    return WRAPPER_TAGS.has(child.tagName) && Object.keys(child.properties).length === 0 ? child.children : [child];
  });
}

const absolute = (value: string, url: string) => {
  try {
    return new URL(value, url).href;
  } catch {
    return value;
  }
};

const absoluteCandidates = (value: string, url: string) =>
  stringifySrcset(parseSrcset(value).map((candidate) => ({ ...candidate, url: absolute(candidate.url, url) })));

function resolveRelativeUrls(article: Element, url: string) {
  visit(article, "element", (element) => {
    for (const property of URL_PROPERTIES) {
      const value = element.properties[property];

      if (typeof value === "string") {
        element.properties[property] = absolute(value, url);
      }
    }

    for (const property of URL_LIST_PROPERTIES) {
      const value = element.properties[property];

      if (typeof value === "string") {
        element.properties[property] = absoluteCandidates(value, url);
      }
    }
  });
}

/**
 * Reads an entry's body from its prerendered document as the HTML a feed reader can show.
 *
 * Reusing the prerendered markup keeps the feed's text identical to the document's and avoids a
 * second render. `FEED_SCHEMA` selects the elements and attributes that belong in the feed.
 */
export function articleContentOf(html: string, url: string): string {
  const articles = selectAll("article", fromHtml(html));

  if (articles.length !== 1) {
    throw new Error(`Expected one <article> in the document for ${url}, found ${articles.length}.`);
  }

  const article = articles[0]!;

  replaceUIMarkup(article);
  resolveRelativeUrls(article, url);

  const sanitizedArticle = sanitize(article, FEED_SCHEMA) as Element;

  return toHtml({ type: "root", children: unwrapPlainWrappers(sanitizedArticle.children) });
}
