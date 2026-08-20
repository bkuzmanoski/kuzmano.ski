import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Plugin } from "vite";

const SITEMAP_FILE = "sitemap.xml";
const WRONG_NAMESPACE = 'xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"';
const NAMESPACE = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

/**
 * Corrects the namespace on the generated sitemap.
 *
 * TanStack Start writes the urlset as `https://www.sitemaps.org/schemas/sitemap/0.9`
 * (hardcoded in `start-plugin-core/src/build-sitemap.ts`), but the sitemap protocol's
 * namespace is the `http://` spelling. XML namespaces compare as literal strings, so the
 * two are different namespaces and a validator reads the document as holding no sitemap
 * elements at all.
 *
 * Runs in `buildApp` after TanStack Start's own post-build hook, which is where the
 * sitemap is written.
 *
 * TODO: Remove this one https://github.com/TanStack/router/pull/8127 is merged.
 */
export function sitemapNamespacePlugin(): Plugin {
  return {
    name: "kuzmano.ski:sitemap-namespace",
    enforce: "post",
    buildApp: {
      order: "post",
      async handler(builder) {
        const clientEnvironment = builder.environments.client;

        if (!clientEnvironment) {
          return;
        }

        const path = resolve(clientEnvironment.config.root, clientEnvironment.config.build.outDir, SITEMAP_FILE);
        const sitemap = await readFile(path, "utf8").catch(() => null);

        if (sitemap === null) {
          console.warn(`[kuzmano.ski:sitemap-namespace] No sitemap at ${path}; skipping the namespace fix.`);
          return;
        }

        if (sitemap.includes(WRONG_NAMESPACE)) {
          await writeFile(path, sitemap.replace(WRONG_NAMESPACE, NAMESPACE));
        }
      },
    },
  };
}
