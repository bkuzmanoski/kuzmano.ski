import { readdirSync } from "node:fs";

const CONTENT_DIR = "src/content";

/**
 * The complete list of pages to prerender, derived from the filesystem.
 *
 * Neither built-in discovery mechanism can produce a complete, non-duplicated
 * list alone: `autoStaticPathsDiscovery` cannot enumerate dynamic routes (it has
 * no way to know which `$slug` values exist), and `crawlLinks` only reaches
 * pages something links to. Enabling both covers everything but emits index
 * routes twice—"/writing/" from discovery and "/writing" from a link—which
 * reaches the sitemap as two URLs for one page.
 *
 * Reading the directory is complete *and* canonical: every post is included
 * whether or not it is linked, each path appears in exactly one form, and adding
 * a collection is a matter of adding a folder rather than editing this list.
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
