import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { entryBodyChunksPlugin } from "./build/content/entry-body-chunks.ts";
import { frontmatterPlugin } from "./build/content/frontmatter.ts";
import { mdxPlugin } from "./build/content/mdx.ts";
import { entryCoverImagesPlugin } from "./build/content/media/entry-cover-images.ts";
import { entryIconUrlsPlugin } from "./build/content/media/entry-icon-urls.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { markdownTokenCountsPlugin } from "./build/markdown/markdown-token-counts.ts";
import { reactPlugins } from "./build/react-compiler.ts";
import { themeColorsPlugin } from "./build/stylesheet/theme-colors.ts";
import { svgrOptions } from "./build/svgr.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    workersRuntimePlugin(),
    inlineScriptsPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    // Enables content catalog resolution (see `/src/site/catalog.ts`) for tests that load the real content catalog.
    // Does not serve cover images; tests that need them mock the module.
    entryCoverImagesPlugin(() => Promise.resolve({})),
    // Enables content catalog resolution (see `/src/site/catalog.ts`) for tests that load the real content catalog.
    // Does not serve entry icon URLs; tests that need them mock the module.
    entryIconUrlsPlugin(() => Promise.resolve({})),
    mdxPlugin({ syntaxHighlight: false }),
    entryBodyChunksPlugin(),
    // Enables the Worker entry to resolve `virtual:markdown-token-counts`; tests that need counts mock the module.
    markdownTokenCountsPlugin(() => Promise.resolve({})),
    themeColorsPlugin(),
    ...reactPlugins(),
  ],
  test: {
    restoreMocks: true,
    // Creating a jsdom accounts for most test-file runtime, so source tests use `vmThreads`, which creates one jsdom
    // per worker rather than per file. Tooling tests use the default pool because native modules (Sharp and Vite
    // bindings) reject VM-created `RegExp` values when validating Node built-in arguments. They run in Node unless a
    // test file specifies `@vitest-environment jsdom`.
    projects: [
      {
        test: {
          name: "src",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          pool: "vmThreads",
        },
      },
      {
        test: {
          name: "tooling",
          include: ["build/**/*.{test,spec}.{ts,tsx}", "*.{test,spec}.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
