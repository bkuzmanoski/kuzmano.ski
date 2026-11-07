import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import postcssMixins from "postcss-mixins";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { entryBodyChunksPlugin } from "./build/content/entry-body-chunks.ts";
import { frontmatterPlugin } from "./build/content/frontmatter.ts";
import { mdxPlugin } from "./build/content/mdx.ts";
import { MEDIA_HEADERS_RULE, contentMedia } from "./build/content/media/plugin.ts";
import { cssAssetsPlugin } from "./build/css-assets.ts";
import { FEED_HEADERS_RULE, atomFeeds } from "./build/feeds/plugin.ts";
import { headersFilePlugin } from "./build/headers.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { LLMS_TXT_HEADERS_RULE } from "./build/markdown/llms-txt.ts";
import { markdownPlugin } from "./build/markdown/plugin.ts";
import { contentProblemsPlugin, prerenderRoutes } from "./build/prerender/routes.ts";
import { verifyPrerenderedDocument } from "./build/prerender/verify.ts";
import { reactCompilerOptimizationFailures, reactPlugins } from "./build/react-compiler.ts";
import { robotsPlugin } from "./build/robots.ts";
import { siteIconsPlugin } from "./build/site-icons/plugin.ts";
import { themeColorsPlugin } from "./build/stylesheet/theme-colors.ts";
import { svgrOptions } from "./build/svgr.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";
import { SITE_URL } from "./src/config/site.ts";

export default defineConfig(({ command }) => {
  const optimizationFailures = reactCompilerOptimizationFailures();
  const { plugins: mediaPlugins, mediaForEntry } = contentMedia();
  const { plugin: feedsPlugin, captureDocument } = atomFeeds();

  return {
    resolve: { tsconfigPaths: true },
    css: {
      postcss: {
        plugins: [
          postcssMixins({ mixinsFiles: "src/mixins.css" }),
          postcssPresetEnv({
            features: {
              "custom-selectors": true,
              "position-area-property": false, // Relevant browsers have support for `position-area` so the alias to `inset-area` is not needed.
            },
          }),
        ],
      },
    },
    plugins: [
      workersRuntimePlugin(),
      themeColorsPlugin(),
      cssAssetsPlugin(),
      headersFilePlugin([MEDIA_HEADERS_RULE, FEED_HEADERS_RULE, LLMS_TXT_HEADERS_RULE]),
      robotsPlugin(),
      siteIconsPlugin(),
      inlineScriptsPlugin(),
      svgr({ svgrOptions }),
      frontmatterPlugin(),
      contentProblemsPlugin(),
      ...mediaPlugins,
      ...markdownPlugin({ mediaForEntry }),
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
      feedsPlugin,
      ...reactPlugins(optimizationFailures.logger),
      optimizationFailures.plugin,
    ],
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // Keep stable framework dependencies in a separately cached chunk. Dependencies used by only one MDX
                // entry remain in that entry's body chunk. Exclude TanStack Start: its client entry imports the router,
                // and grouping a module also groups its dependencies, which would otherwise pull the entire site into
                // this chunk.
                groups: [
                  {
                    name: "framework",
                    test: /node_modules[\\/](react|react-dom|scheduler|seroval|seroval-plugins|@tanstack[\\/](react-router|router-core|history|store|react-store))[\\/]/,
                  },
                ],
              },
            },
          },
        },
      },
    },
    server: { host: true },
  };
});
