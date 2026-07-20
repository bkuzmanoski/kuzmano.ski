import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { mdxPlugin } from "./build/mdx";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [mdxPlugin({ highlight: false }), viteReact({ include: /\.(tsx?|mdx)$/ })],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
