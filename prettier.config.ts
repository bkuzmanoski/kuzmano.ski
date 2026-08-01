import type { Config } from "prettier";

export default {
  overrides: [
    { files: ["*.md", "*.mdx"], options: { printWidth: 80, proseWrap: "always" } },
    { files: "*.jsonc", options: { trailingComma: "none" } },
    { files: "*.svg", options: { parser: "html" } },
  ],
  printWidth: 120,
} satisfies Config;
