import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { frontmatterPlugin } from "./build/frontmatter.ts";
import { inlineScriptsPlugin } from "./build/inline-scripts.ts";
import { mdxPlugin } from "./build/mdx.ts";
import { svgrOptions } from "./build/svgr.ts";
import { workersRuntimePlugin } from "./build/workers-runtime.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    workersRuntimePlugin(),
    inlineScriptsPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    mdxPlugin({ syntaxHighlight: false }),
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
