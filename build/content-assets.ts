import { relative } from "node:path";

import { CONTENT_DIRECTORY, fromRoot } from "./paths.ts";

import type { Plugin } from "vite";

const MODULE_ID = "virtual:content-assets";
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;

// The environment names TanStack Start uses for its client and server builds.
const CLIENT_ENVIRONMENT = "client";
const SERVER_ENVIRONMENT = "ssr";

const contentRoot = fromRoot(CONTENT_DIRECTORY);

/** The `import.meta.glob` key for a content file, or null for a non-content module. */
export function contentKeyOf(moduleId: string | null | undefined): string | null {
  if (!moduleId?.endsWith(".mdx")) {
    return null;
  }

  const path = relative(contentRoot, moduleId);

  return path.startsWith("..") ? null : `/${CONTENT_DIRECTORY}/${path}`;
}

/**
 * Provides `virtual:content-assets` as a map from each content file to the URL of the client chunk
 * that contains its compiled MDX. The keys use the same paths as `import.meta.glob` (see
 * `/src/site/catalog.ts`).
 *
 * The client normally loads a page's compiled MDX on demand, after the page has started running.
 * The server can put the chunk URL in the page instead, allowing the browser to fetch it while
 * the page is loading. This avoids making hydration wait for another request (see
 * `/src/client.tsx`).
 *
 * Only the server build needs this map. A window opened after the page loads imports its content
 * when it renders, so there is no earlier request to avoid. The map is also empty during
 * development, where Vite serves modules directly instead of bundling them.
 */
export function contentAssetsPlugin(): Array<Plugin> {
  let assets: Record<string, string> = {};
  return [
    {
      name: "kuzmano.ski:content-assets-capture",
      applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
      enforce: "post",
      generateBundle(_options, bundle) {
        const { base } = this.environment.config;

        assets = {};

        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type !== "chunk") {
            continue;
          }

          const key = contentKeyOf(output.facadeModuleId);

          if (key) {
            assets[key] = `${base}${fileName}`;
          }
        }
      },
    },
    {
      name: "kuzmano.ski:content-assets",
      enforce: "pre",
      resolveId: (source) => (source === MODULE_ID ? RESOLVED_MODULE_ID : null),
      load(id) {
        if (id !== RESOLVED_MODULE_ID) {
          return null;
        }

        const isServerBuild =
          this.environment.name === SERVER_ENVIRONMENT && this.environment.config.command === "build";

        return `export const CONTENT_ASSETS = ${JSON.stringify(isServerBuild ? assets : {})};`;
      },
    },
  ];
}
