import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssMixins from "postcss-mixins";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { entryBodyChunksPlugin } from "./build/content/entry-body-chunks.ts";
import { frontmatterPlugin } from "./build/content/frontmatter.ts";
import { mdxPlugin } from "./build/content/mdx.ts";
import { contentMedia } from "./build/content/media/plugin.ts";
import { cssAssetsPlugin } from "./build/css-assets.ts";
import { captureDocument, feedsPlugin } from "./build/feeds/plugin.ts";
import { headersFile } from "./build/headers.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { markdownPlugin } from "./build/markdown/plugin.ts";
import { prerenderRoutes } from "./build/prerender/routes.ts";
import { sitemapNamespacePlugin } from "./build/prerender/sitemap-namespace.ts";
import { verifyPrerenderedDocument } from "./build/prerender/verify.ts";
import { reactCompilerOptimizationFailures } from "./build/react-compiler.ts";
import { robotsPlugin } from "./build/robots.ts";
import { siteIconsPlugin } from "./build/site-icons/plugin.ts";
import { layoutMetricsPlugin } from "./build/stylesheet/layout-metrics.ts";
import { themeColorsPlugin } from "./build/stylesheet/theme-colors.ts";
import { svgrOptions } from "./build/svgr.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";
import { SITE_URL } from "./src/config/site.ts";

export default defineConfig(({ command }) => {
  const optimizationFailures = reactCompilerOptimizationFailures();
  const { plugin: headersPlugin, addHeadersRules } = headersFile();
  const { plugins: mediaPlugins, mediaForEntry } = contentMedia({ addHeadersRules });

  return {
    resolve: { tsconfigPaths: true },
    css: {
      postcss: {
        plugins: [
          postcssMixins({ mixinsFiles: "src/mixins.css" }),
          postcssPresetEnv({
            features: { "position-area-property": false }, // Relevant browsers have support for `position-area` so the alias to `inset-area` is not needed.
          }),
        ],
      },
    },
    plugins: [
      workersRuntimePlugin(),
      themeColorsPlugin(),
      cssAssetsPlugin(),
      headersPlugin,
      robotsPlugin(),
      siteIconsPlugin(),
      inlineScriptsPlugin(),
      layoutMetricsPlugin(),
      svgr({ svgrOptions }),
      frontmatterPlugin(),
      ...mediaPlugins,
      ...markdownPlugin({ mediaForEntry, addHeadersRules }),
      mdxPlugin({ mediaForEntry }),
      entryBodyChunksPlugin(),
      tanstackStart({
        server: { entry: "worker" },
        router: { routeFileIgnorePattern: "\\.test\\." },
        pages: command === "build" ? prerenderRoutes() : [],
        sitemap: { host: SITE_URL },
        prerender: {
          enabled: true,
          crawlLinks: false,
          autoStaticPathsDiscovery: false,
          onSuccess: (result) => {
            verifyPrerenderedDocument(result);
            captureDocument(result);
          },
        },
      }),
      sitemapNamespacePlugin(),
      feedsPlugin({ addHeadersRules }),
      viteReact({ include: /\.(tsx?|mdx)$/ }),
      babel({ presets: [reactCompilerPreset({ logger: optimizationFailures.logger })] }),
      optimizationFailures.plugin,
    ],
    server: { host: true },
  };
});
