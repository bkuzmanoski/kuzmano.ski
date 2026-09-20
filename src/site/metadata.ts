import { FEED_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE } from "#/config/media-types.ts";
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "#/config/site.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { markdownPath } from "#/lib/content/paths.ts";

interface FeedLink {
  title: string;
  path: string;
}

export interface DocumentMetadata {
  title: string; // The document's own title, without the site suffix `documentTitle` adds.
  description: string;
  path: string;
  kind?: "website" | "article"; // Open Graph type. Dated, authored entries are "article"; everything else is "website".
  bodyChunkUrl?: string | null; // URL of the chunk holding the entry's compiled content, preloaded so it is available to hydration.
  coverImage?: CoverImage | null; // Used as `og:image` in place of the site image.
  markdown?: boolean; // Whether the document has a Markdown representation to advertise.
  feed?: FeedLink;
  noindex?: boolean;
}

export const documentTitle = (title: string) => `${title}—${SITE_NAME}`;
export const canonicalUrl = (path: string) => `${SITE_URL}${path}`;
export const markdownUrl = (path: string) => canonicalUrl(markdownPath(path));

/**
 * The head tags for a document.
 *
 * `HeadContent` keys meta tags on `name ?? property` and lets the deepest match win, so a
 * route overrides a tag from the root by re-declaring it under the same key.
 */
export function documentHead({
  title,
  description,
  path,
  kind = "website",
  bodyChunkUrl,
  coverImage,
  markdown,
  feed,
  noindex,
}: DocumentMetadata) {
  const url = canonicalUrl(path);
  const fullTitle = path === "/" ? SITE_NAME : documentTitle(title);
  const socialImage = coverImage?.social ?? { src: SOCIAL_IMAGE, width: undefined, height: undefined };

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
      { property: "og:image", content: canonicalUrl(socialImage.src) },
      ...(socialImage.width && socialImage.height
        ? [
            { property: "og:image:width", content: String(socialImage.width) },
            { property: "og:image:height", content: String(socialImage.height) },
          ]
        : []),
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: url },
      ...(bodyChunkUrl ? [{ rel: "modulepreload", href: bodyChunkUrl }] : []),
      ...(markdown
        ? [{ rel: "alternate", type: MARKDOWN_MEDIA_TYPE, href: markdownUrl(path), title: "Markdown" }]
        : []),
      ...(feed ? [{ rel: "alternate", type: FEED_MEDIA_TYPE, href: feed.path, title: feed.title }] : []),
    ],
  };
}
