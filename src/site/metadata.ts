import { FEED_TYPE, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "#/config/site";

/** A feed advertised in a document's head. */
export interface FeedLink {
  title: string;
  path: string;
}

export interface DocumentMetadata {
  title: string; // The page's own title, without the site suffix `documentTitle` adds.
  description: string;
  path: string;
  kind?: "website" | "article"; // Open Graph type. Dated, authored pages are "article"; everything else is "website".
  contentAsset?: string | null; // URL of the chunk holding the page's compiled content, preloaded so it is available to hydration (see `/build/content-assets.ts`).
  markdown?: boolean; // Whether the page has a markdown alternate to advertise (see `/build/markdown.ts`).
  feed?: FeedLink;
  noindex?: boolean;
}

export const documentTitle = (title: string) => `${title}—${SITE_NAME}`;
export const canonicalUrl = (path: string) => `${SITE_URL}${path}`;
export const markdownPath = (path: string) => `${path}.md`;
export const markdownUrl = (path: string) => canonicalUrl(markdownPath(path));

/**
 * The head tags for a page.
 *
 * `HeadContent` keys meta tags on `name ?? property` and lets the deepest match win, so a
 * route overrides a tag from the root by re-declaring it under the same key.
 */
export function documentHead({
  title,
  description,
  path,
  kind = "website",
  contentAsset,
  markdown,
  feed,
  noindex,
}: DocumentMetadata) {
  const url = canonicalUrl(path);
  const fullTitle = path === "/" ? SITE_NAME : documentTitle(title);

  return {
    meta: [
      { title: fullTitle },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
      { property: "og:type", content: kind },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: fullTitle },
      ...(description ? [{ property: "og:description", content: description }] : []),
      { property: "og:url", content: url },
      { property: "og:image", content: canonicalUrl(SOCIAL_IMAGE) },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: url },
      ...(contentAsset ? [{ rel: "modulepreload", href: contentAsset }] : []),
      ...(markdown ? [{ rel: "alternate", type: "text/markdown", href: markdownUrl(path), title: "Markdown" }] : []),
      ...(feed ? [{ rel: "alternate", type: FEED_TYPE, href: feed.path, title: feed.title }] : []),
    ],
  };
}
