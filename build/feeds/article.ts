import { fromHtml } from "hast-util-from-html";
import { defaultSchema, sanitize } from "hast-util-sanitize";
import { toHtml } from "hast-util-to-html";

import type { Element, ElementContent, Nodes, Parents, RootContent } from "hast";
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
    video: ["controls", "loop", "muted", "playsInline", "poster", "preload", "src"],
    audio: ["controls", "loop", "muted", "preload", "src"],
    track: ["default", "kind", "src", "srcLang"],
  },
  clobber: [],
};
const WRAPPER_TAGS = new Set(["span", "div"]);
const URL_ATTRIBUTES = ["href", "src", "poster"];
const URL_LIST_ATTRIBUTES = ["srcSet"];

const isElement = (node: Nodes): node is Element => node.type === "element";
const childrenOf = (node: Nodes): Array<RootContent> => ("children" in node ? node.children : []);

function walk(node: Nodes, visit: (node: Nodes) => void) {
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
}

function articlesIn(tree: Nodes): Array<Element> {
  const found: Array<Element> = [];

  walk(tree, (node) => {
    if (isElement(node) && node.tagName === "article") {
      found.push(node);
    }
  });

  return found;
}

function removeUIMarkup(node: Parents) {
  node.children = node.children.filter(
    (child) => !(isElement(child) && ("dataHeadingLink" in child.properties || "dataFeedOmit" in child.properties)),
  );
  node.children.forEach((child) => {
    if ("children" in child) {
      removeUIMarkup(child);
    }
  });
}

// Sanitizing removes the attributes from the wrappers used for syntax highlighting
// and page UI, leaving elements that hold nothing but their children.
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
    return value; // Left as written.
  }
};

// A `srcset` is a comma-separated list of candidates, each a URL followed by an optional descriptor.
const absoluteCandidates = (value: string, url: string) =>
  value
    .split(",")
    .map((candidate) => {
      const [source, ...descriptor] = candidate.trim().split(/\s+/);
      return source ? [absolute(source, url), ...descriptor].join(" ") : "";
    })
    .filter(Boolean)
    .join(", ");

function resolveRelativeUrls(node: Nodes, url: string) {
  walk(node, (candidate) => {
    if (!isElement(candidate)) {
      return;
    }

    for (const property of URL_ATTRIBUTES) {
      const value = candidate.properties[property];

      if (typeof value === "string") {
        candidate.properties[property] = absolute(value, url);
      }
    }

    for (const property of URL_LIST_ATTRIBUTES) {
      const value = candidate.properties[property];

      if (typeof value === "string") {
        candidate.properties[property] = absoluteCandidates(value, url);
      } else if (Array.isArray(value)) {
        candidate.properties[property] = value.map((entry) => absoluteCandidates(String(entry), url));
      }
    }
  });
}

/**
 * Reads an entry's body from its prerendered page as the HTML a feed reader can show.
 *
 * Reusing the prerendered markup keeps the feed's text identical to the page's and avoids a
 * second render. `FEED_SCHEMA` selects the elements and attributes that belong in the feed.
 */
export function articleContentOf(html: string, url: string): string {
  const articles = articlesIn(fromHtml(html));

  if (articles.length !== 1) {
    throw new Error(`Expected one <article> in the page for ${url}, found ${articles.length}.`);
  }

  const article = articles[0]!;

  removeUIMarkup(article);
  resolveRelativeUrls(article, url);

  const sanitized = sanitize(article, FEED_SCHEMA) as Element;

  return toHtml({ type: "root", children: unwrapPlainWrappers(sanitized.children) });
}
