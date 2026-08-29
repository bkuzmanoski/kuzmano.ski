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
    "time",
    "mark",
  ],
  // A disallowed element is otherwise unwrapped, which would leave a control's label as loose text.
  strip: ["script", "style", "svg", "button", "form", "input", "select", "textarea", "object", "iframe", "template"],
  attributes: {
    ...defaultSchema.attributes,
    "*": (defaultSchema.attributes?.["*"] ?? []).filter((attribute) => attribute !== "tabIndex"),
  },
  clobber: [], // Feed markup does not need ids renamed because it is not inserted into the site's document.
};

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

// Sanitizing removes the attributes from spans used for syntax highlighting and page UI, leaving empty wrappers.
function unwrapPlainSpans(children: Array<ElementContent>): Array<ElementContent> {
  return children.flatMap((child) => {
    if (child.type !== "element") {
      return [child];
    }

    child.children = unwrapPlainSpans(child.children);

    return child.tagName === "span" && Object.keys(child.properties).length === 0 ? child.children : [child];
  });
}

function resolveRelativeUrls(node: Nodes, url: string) {
  walk(node, (candidate) => {
    if (!isElement(candidate)) {
      return;
    }

    for (const property of ["href", "src"]) {
      const value = candidate.properties[property];

      if (typeof value !== "string") {
        continue;
      }

      try {
        candidate.properties[property] = new URL(value, url).href;
      } catch {
        // Ignored.
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

  return toHtml({ type: "root", children: unwrapPlainSpans(sanitized.children) });
}
