import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { frontmatterPlugin } from "./build/frontmatter";
import { inlineScriptPlugin } from "./build/inline-script";
import { mdxPlugin } from "./build/mdx";
import { svgrOptions } from "./build/svgr";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    inlineScriptPlugin(),
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    mdxPlugin({ syntaxHighlight: false }),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
