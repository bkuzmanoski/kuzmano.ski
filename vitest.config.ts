import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { entryBodyChunksPlugin } from "./build/content/entry-body-chunks.ts";
import { entryCoverImagesPlugin } from "./build/content/entry-cover-images.ts";
import { frontmatterPlugin } from "./build/content/frontmatter.ts";
import { mdxPlugin } from "./build/content/mdx.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { markdownTokenCountsPlugin } from "./build/markdown/markdown-token-counts.ts";
import { layoutMetricsPlugin } from "./build/stylesheet/layout-metrics.ts";
import { themeColorsPlugin } from "./build/stylesheet/theme-colors.ts";
import { svgrOptions } from "./build/svgr.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    workersRuntimePlugin(),
    inlineScriptsPlugin(),
    layoutMetricsPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    // Enables content catalog resolution (see `/src/site/catalog.ts`) for tests that load the real content catalog.
    // Does not serve cover images; tests provide them through `EntryCoverImagesContext` or by mocking the module.
    entryCoverImagesPlugin(() => Promise.resolve({})),
    mdxPlugin({ syntaxHighlight: false }),
    entryBodyChunksPlugin(),
    // Enables the Worker entry to resolve `virtual:markdown-token-counts`; tests that need counts mock the module.
    markdownTokenCountsPlugin(() => Promise.resolve({})),
    themeColorsPlugin(),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
