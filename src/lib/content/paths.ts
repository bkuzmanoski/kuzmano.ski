// This module has no imports, so build plugins can use it.

export interface ContentPath {
  segment: string;
  slug?: string;
}

/** The top-level URL segment content media is served under. */
export const MEDIA_SEGMENT = "media";

export const pageRoute = (slug: string) => `/${slug}`;
export const entryRoute = (segment: string, slug: string) => `/${segment}/${slug}`;
export const collectionRoute = (segment: string) => `/${segment}`;
export const mediaRoute = (mediaPath: string) => `/${MEDIA_SEGMENT}/${mediaPath}`;

const segmentsOf = (path: string) => path.split("/").filter(Boolean); // Dropping empty parts ignores leading, trailing, and repeated slashes.

export const isRootPath = (path: string) => segmentsOf(path).length === 0;

export function parseContentPath(path: string): ContentPath | null {
  const segments = segmentsOf(path);

  if (segments.length === 0 || segments.length > 2) {
    return null;
  }

  const [segment, slug] = segments as [string, string | undefined];

  return slug === undefined ? { segment } : { segment, slug };
}
