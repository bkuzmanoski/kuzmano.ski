import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { content } from "./build/content";
import { frontmatterPlugin } from "./build/frontmatter";
import { inlineScriptPlugin } from "./build/inline-script";
import { mdxPlugin } from "./build/mdx";
import { verifyPrerenderedPage } from "./build/prerender";
import { svgrOptions } from "./build/svgr";

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
    inlineScriptPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    mdxPlugin(),
    tanstackStart({
      router: { routeFileIgnorePattern: ".test.tsx" },
      pages: command === "build" ? content() : [],
      sitemap: { host: "https://kuzmano.ski" },
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        onSuccess: verifyPrerenderedPage,
      },
    }),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: { host: true },
}));
