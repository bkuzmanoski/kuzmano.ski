import { readdirSync } from "node:fs";
import { join } from "node:path";

import mdx from "@mdx-js/rollup";
import babel from "@rolldown/plugin-babel";
import rehypeShiki from "@shikijs/rehype";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

const collections = ["writing", "projects"];

function contentPages() {
  const indexes = collections.map((name) => `/${name}`);
  const posts = collections.flatMap((name) =>
    readdirSync(join("src/content", name))
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => `/${name}/${file.replace(/\.mdx$/, "")}`),
  );

  return ["/", ...indexes, ...posts].map((path) => ({ path }));
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  css: { postcss: { plugins: [postcssPresetEnv()] } },
  plugins: [
    devtools(),
    {
      enforce: "pre",
      ...mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeShiki,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
            },
          ],
        ],
      }),
    },
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
      sitemap: { host: "https://kuzmano.ski" },
      pages: [
        ...contentPages(),
        {
          path: "/404",
          sitemap: { exclude: true },
          prerender: { enabled: true, outputPath: "/404.html", autoSubfolderIndex: false },
        },
      ],
    }),
    viteReact({ include: /\.([jt]sx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
