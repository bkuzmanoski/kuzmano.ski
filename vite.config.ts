import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { frontmatterPlugin } from "./build/frontmatter.ts";
import { iconDriftPlugin } from "./build/icons/drift.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { mdxPlugin } from "./build/mdx.ts";
import { prerenderRoutes } from "./build/prerender/routes.ts";
import { verifyPrerenderedPage } from "./build/prerender/verify.ts";
import { reactCompilerBailouts } from "./build/react-compiler.ts";
import { sitemapNamespacePlugin } from "./build/sitemap-namespace.ts";
import { svgrOptions } from "./build/svgr.ts";
import { themeColorPlugin } from "./build/theme-color.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";
import { SITE_URL } from "./src/config/site.ts";

export default defineConfig(({ command }) => {
  const compilerBailouts = reactCompilerBailouts();

  return {
    resolve: { tsconfigPaths: true },
    css: {
      postcss: {
        plugins: [
          postcssPresetEnv({
            features: { "position-area-property": false }, // Relevant browsers have support for `position-area` so the alias to `inset-area` is not needed.
          }),
        ],
      },
    },
    plugins: [
      workersRuntimePlugin(),
      themeColorPlugin(),
      iconDriftPlugin(),
      inlineScriptsPlugin(),
      svgr({ svgrOptions }),
      frontmatterPlugin(),
      mdxPlugin(),
      tanstackStart({
        router: { routeFileIgnorePattern: "\\.test\\." },
        pages: command === "build" ? prerenderRoutes() : [],
        sitemap: { host: SITE_URL },
        prerender: {
          enabled: true,
          crawlLinks: false,
          autoStaticPathsDiscovery: false,
          onSuccess: verifyPrerenderedPage,
        },
      }),
      sitemapNamespacePlugin(),
      viteReact({ include: /\.(tsx?|mdx)$/ }),
      babel({ presets: [reactCompilerPreset({ logger: compilerBailouts.logger })] }),
      compilerBailouts.plugin,
    ],
    server: { host: true },
  };
});
