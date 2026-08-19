export const SITE_NAME = "Brian Kuzmanoski";
export const SITE_URL = "https://kuzmano.ski";
export const SITE_DESCRIPTION = "The personal site of Brian Kuzmanoski: work, notes and experience.";
export const SITE_SOURCE_URL = "https://github.com/bkuzmanoski/kuzmano.ski";
export const NOT_FOUND_TITLE = "Page not found (404)";

const SOCIAL_IMAGE = "/logo512.png";

export interface DocumentMetadata {
  title: string; // The page's own title, without the site suffix `documentTitle` adds.
  description: string;
  path: string; // The route's path, from "/" down. Becomes the canonical URL.
  kind?: "website" | "article"; // Open Graph type. Dated, authored pages are "article"; everything else is "website".
}

export const documentTitle = (title: string) => `${title}—${SITE_NAME}`;
export const canonicalUrl = (path: string) => `${SITE_URL}${path}`;

/**
 * The head tags for a page.
 *
 * `HeadContent` keys meta tags on `name ?? property` and lets the deepest match win, so a
 * route overrides a tag from the root by re-declaring it under the same key.
 */
export function documentHead({ title, description, path, kind = "website" }: DocumentMetadata) {
  const url = canonicalUrl(path);
  const fullTitle = path === "/" ? SITE_NAME : documentTitle(title);

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:type", content: kind },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: canonicalUrl(SOCIAL_IMAGE) },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
