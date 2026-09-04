// The URL shape content is served under:
//
// - pages at `/<slug>`
// - collection entries at `/<segment>/<slug>`
// - collections at `/<segment>`.
//
// Free of Node and Vite imports so the build plugins can read it, and free of configuration
// so it belongs in `/src/lib`. `/src/site/content-routes.ts` layers the site's reserved routes
// over it and is what everything outside `/src/lib` imports.

export interface ContentPath {
  segment: string;
  slug?: string;
}

export const pageRoute = (slug: string) => `/${slug}`;
export const entryRoute = (segment: string, slug: string) => `/${segment}/${slug}`;
export const collectionRoute = (segment: string) => `/${segment}`;

const segmentsOf = (path: string) => path.split("/").filter(Boolean); // Dropping empty parts ignores leading, trailing and repeated slashes.

/** Whether a path addresses the site root, which has no content of its own. */
export const isRootPath = (path: string) => segmentsOf(path).length === 0;

/**
 * The content a path addresses, or `null` when it addresses none: the root, or a path
 * deeper than a collection entry.
 */
export function parseContentPath(path: string): ContentPath | null {
  const segments = segmentsOf(path);

  if (segments.length === 0 || segments.length > 2) {
    return null;
  }

  const [segment, slug] = segments as [string, string | undefined];

  return slug === undefined ? { segment } : { segment, slug };
}
