import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  ...tanstackConfig,
  { ignores: [".output/**/*"] },
  {
    name: "kuzmano.ski/imports",
    rules: {
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
