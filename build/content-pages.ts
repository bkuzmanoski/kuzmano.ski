import { readdirSync } from "node:fs";

const CONTENT_DIR = "src/content";

/**
 * Makes the complete list of pages to prerender.
 *
 * This function reads the file system. The built-in discovery options cannot
 * make a complete list without duplicates:
 *
 * - `autoStaticPathsDiscovery` does not list dynamic routes
 * - `crawlLinks` does not find pages that have no links to them
 * - Both options together add some routes two times
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
