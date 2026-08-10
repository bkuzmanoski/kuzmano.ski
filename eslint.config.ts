import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default defineConfig(
  ...tanstackConfig,
  { ignores: [".output/**/*", ".wrangler/**/*", "dist/**/*", "**/routeTree.gen.ts"] },
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  {
    name: "kuzmano.ski/routes",
    files: ["src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true, allowExportNames: ["Route"] }],
    },
  },
  {
    name: "kuzmano.ski/imports",
    settings: {
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".tsx", ".mjs", ".js", ".json"] })],
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/lib",
              from: ["./src/components", "./src/config", "./src/content", "./src/routes", "./src/views"],
            },
            { target: "./src/components", from: ["./src/routes", "./src/views"] },
          ],
        },
      ],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
          pathGroups: [{ pattern: "#/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
);
