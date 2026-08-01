import viteReact from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

import { frontmatterPlugin } from "./build/frontmatter";
import { mdxPlugin } from "./build/mdx";
import { svgrOptions } from "./build/svgr";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    svgr({ svgrOptions }),
    frontmatterPlugin(),
    mdxPlugin({ syntaxHighlight: false }),
    viteReact({ include: /\.(tsx?|mdx)$/ }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
