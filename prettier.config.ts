import type { Config } from "prettier";

export default {
  overrides: [
    { files: "*.jsonc", options: { trailingComma: "none" } },
    { files: "*.svg", options: { parser: "html" } },
  ],
  printWidth: 120,
} satisfies Config;
