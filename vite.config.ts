import babel from "@rolldown/plugin-babel";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import { defineConfig } from "vite";

import { contentPages } from "./build/content-pages";
import { mdxPlugin } from "./build/mdx";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  css: { postcss: { plugins: [postcssPresetEnv()] } },
  plugins: [
    devtools(),
    mdxPlugin(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
      sitemap: { host: "https://kuzmano.ski" },
      pages: contentPages(),
    }),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
