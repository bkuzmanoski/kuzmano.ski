import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { entryBodyChunksPlugin } from "./build/content/entry-body-chunks.ts";
import { entryCoverImagesPlugin } from "./build/content/entry-cover-images.ts";
import { frontmatterPlugin } from "./build/content/frontmatter.ts";
import { mdxPlugin } from "./build/content/mdx.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
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
    // Required for content catalog resolution (see `/src/site/catalog.ts`) and tests that load the real content catalog.
    // No cover images are served; a test provides them through `EntryCoverImagesContext` or by mocking this module.
    entryCoverImagesPlugin(() => Promise.resolve({})),
    mdxPlugin({ syntaxHighlight: false }),
    entryBodyChunksPlugin(),
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
