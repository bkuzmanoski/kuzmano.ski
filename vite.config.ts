import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { content } from "./build/content.ts";
import { frontmatterPlugin } from "./build/frontmatter.ts";
import { iconDriftCheckPlugin } from "./build/icon-lock.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { mdxPlugin } from "./build/mdx.ts";
import { verifyPrerenderedPage } from "./build/prerender.ts";
import { sitemapNamespaceFixPlugin } from "./build/sitemap-namespace-fix.ts";
import { svgrOptions } from "./build/svgr.ts";
import { themeColorPlugin } from "./build/theme-color.ts";
import { SITE_URL } from "./src/config/site.ts";

export default defineConfig(({ command }) => ({
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
    themeColorPlugin(),
    iconDriftCheckPlugin(),
    inlineScriptsPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    mdxPlugin(),
    tanstackStart({
      router: { routeFileIgnorePattern: "\\.test\\." }, // Suites beside the routes they cover, in either extension.
      pages: command === "build" ? content() : [],
      sitemap: { host: SITE_URL },
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        onSuccess: verifyPrerenderedPage,
      },
    }),
    sitemapNamespaceFixPlugin(),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: { host: true },
}));
