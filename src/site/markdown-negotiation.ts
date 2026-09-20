import { HTML_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE } from "#/config/media-types.ts";
import { markdownPath } from "#/lib/content/paths.ts";

import { isRootPath } from "./routes.ts";

// Content negotiation for the Markdown representation each document links as its `text/markdown` alternate.

export const MARKDOWN_TOKEN_COUNT_HEADER = "x-markdown-tokens";

const DEFAULT_QUALITY = 1;
const QUALITY_PARAMETER = /^q=(\d(?:\.\d{0,3})?)$/;
const TRAILING_SLASH = /.\/$/;
const FILE_NAME_EXTENSION = /\.[^/]*$/;

// Returns a media type's declared quality, or 0 when it is absent. Ignores wildcards so browsers'
// trailing `*/*` does not select `text/markdown`.
function qualityFor(mediaType: string, acceptHeader: string): number {
  let quality = 0;

  for (const mediaRange of acceptHeader.split(",")) {
    const [name, ...parameters] = mediaRange.split(";").map((part) => part.trim().toLowerCase());

    if (name !== mediaType) {
      continue;
    }

    const declaredQuality = parameters.map((parameter) => QUALITY_PARAMETER.exec(parameter)?.[1]).find(Boolean);

    quality = Math.max(quality, declaredQuality === undefined ? DEFAULT_QUALITY : Number(declaredQuality));
  }

  return quality;
}

export function prefersMarkdown(acceptHeader: string | null | undefined): boolean {
  if (!acceptHeader) {
    return false;
  }

  const markdownQuality = qualityFor(MARKDOWN_MEDIA_TYPE, acceptHeader);

  return markdownQuality > 0 && markdownQuality >= qualityFor(HTML_MEDIA_TYPE, acceptHeader);
}

export function markdownRepresentationPathFor(pathname: string): string | null {
  if (isRootPath(pathname) || TRAILING_SLASH.test(pathname) || FILE_NAME_EXTENSION.test(pathname)) {
    return null;
  }

  return markdownPath(pathname);
}

export const isMarkdownPath = (pathname: string) => pathname.endsWith(".md");
