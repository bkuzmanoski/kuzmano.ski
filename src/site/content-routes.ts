import { CONTACT_ROUTE } from "#/config/contact.ts";
import { pageRoute } from "#/lib/content/paths.ts";

/**
 * The site's route vocabulary: the content URL shape from `/src/lib/content/paths.ts` plus the
 * routes the site reserves for windows that have no content file behind them.
 *
 * Re-exported together so callers outside `/src/lib` have one import for the whole vocabulary.
 * Keep this module free of Node and Vite imports so the build plugins can read it too.
 */

export { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "#/lib/content/paths.ts";
export type { ContentPath } from "#/lib/content/paths.ts";

/** Routes served by a window rather than by a content file. Content that resolves to one would shadow it. */
export const RESERVED_ROUTES: Array<string> = [CONTACT_ROUTE];

/** The reserved route a top-level segment would shadow, or `undefined` when it shadows no reserved route. */
export const reservedRouteFor = (segment: string): string | undefined =>
  RESERVED_ROUTES.find((route) => route === pageRoute(segment));
