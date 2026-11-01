// Imports only leaf modules because `/vite.config.ts` loads this module through `/build`.
import { FEED_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE } from "#/config/media-types.ts";
import { AUTHOR_NAME, OPEN_GRAPH_IMAGE, SITE_URL } from "#/config/site.ts";
import type { EntryBodyChunks } from "#/lib/content/catalog.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { markdownPath } from "#/lib/content/paths.ts";

import type { AlternateRepresentations } from "./alternate-representations.ts";

/** Alternate representations are advertised as `rel="alternate"` links and omitted when `null`. */
export interface DocumentMetadata extends Partial<AlternateRepresentations> {
  /** The document's own title, without the site suffix `documentTitle` adds. */
  title: string;
  description: string;
  path: string;
  /** Open Graph type. Dated, authored entries are "article"; everything else is "website". */
  kind?: "website" | "article";
  /** Linked so the entry's stylesheets apply to the first paint and its body is available to hydration. */
  bodyChunks?: EntryBodyChunks | null;
  /** Used as `og:image` in place of the site image. */
  coverImage?: CoverImage | null;
  noindex?: boolean;
}

export const canonicalUrl = (path: string) => `${SITE_URL}${path}`;

export const LLMS_TXT_FILE_NAME = "llms.txt";
export const LLMS_TXT_PATH = `/${LLMS_TXT_FILE_NAME}`;

/** Absolute, like the `describedby` link in the `<head>`. */
export const LLMS_TXT_LINK_HEADER = `<${canonicalUrl(LLMS_TXT_PATH)}>; rel="describedby"`;

export const documentTitle = (title: string) => `${title}—${AUTHOR_NAME}`;
export const markdownUrl = (path: string) => canonicalUrl(markdownPath(path));

/**
 * The head tags for a document.
 *
 * `HeadContent` keys meta tags on `name ?? property` and lets the deepest match win, so a route overrides a tag from
 * the root by re-declaring it under the same key.
 */
export function documentHead({
  title,
  description,
  path,
  kind = "website",
  bodyChunks,
  coverImage,
  markdownRepresentationPath,
  feed,
  noindex,
}: DocumentMetadata) {
  const url = canonicalUrl(path);
  const fullTitle = path === "/" ? AUTHOR_NAME : documentTitle(title);
  const openGraphImage = coverImage ?? { src: OPEN_GRAPH_IMAGE, width: undefined, height: undefined };

  return {
    meta: [
      { title: fullTitle },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
      { property: "og:type", content: kind },
      { property: "og:site_name", content: AUTHOR_NAME },
      { property: "og:title", content: fullTitle },
      ...(description ? [{ property: "og:description", content: description }] : []),
      { property: "og:url", content: url },
      { property: "og:image", content: canonicalUrl(openGraphImage.src) },
      ...(openGraphImage.width && openGraphImage.height
        ? [
            { property: "og:image:width", content: String(openGraphImage.width) },
            { property: "og:image:height", content: String(openGraphImage.height) },
          ]
        : []),
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: url },
      ...(bodyChunks?.stylesheetUrls ?? []).map((href) => ({
        rel: "stylesheet",
        href,
        precedence: "entry", // The React precedence for entry stylesheets, ensuring their rules follow and override the site's default styles after navigation.
      })),
      ...(bodyChunks?.moduleUrls ?? []).map((href) => ({ rel: "modulepreload", href })),
      ...(markdownRepresentationPath
        ? [
            {
              rel: "alternate",
              type: MARKDOWN_MEDIA_TYPE,
              href: canonicalUrl(markdownRepresentationPath),
              title: "Markdown",
            },
          ]
        : []),
      ...(feed ? [{ rel: "alternate", type: FEED_MEDIA_TYPE, href: feed.path, title: feed.title }] : []),
      { rel: "describedby", href: canonicalUrl(LLMS_TXT_PATH) },
    ],
  };
}
