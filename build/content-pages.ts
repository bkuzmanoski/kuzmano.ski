import { readdirSync } from "node:fs";

const CONTENT_DIR = "src/content";

/**
 * The complete list of pages to prerender.
 *
 * Derived from the filesystem because the built-in discovery mechanisms
 * cannot produce a complete, non-duplicated list alone:
 *
 * - `autoStaticPathsDiscovery` does not enumerate dynamic routes
 * - `crawlLinks` does not reach unlinked pages
 * - Enabling both emits index routes twice
 */
export function contentPages(): Array<{ path: string }> {
  const collections = readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const paths = collections.flatMap((name) => [
    `/${name}`,
    ...readdirSync(`${CONTENT_DIR}/${name}`)
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => `/${name}/${file.replace(/\.mdx$/, "")}`),
  ]);

  return ["/", ...paths].map((path) => ({ path }));
}
