import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const BUILD_IGNORE_PATTERN = "**/build/**";

/* TanStack's shared config ignores every `build` directory; in this
 * project build/` contains first-party Vite plugins and script. */
const baseConfig = tanstackConfig.map((config) =>
  config.name === "tanstack/ignores"
    ? { ...config, ignores: config.ignores?.filter((pattern) => pattern !== BUILD_IGNORE_PATTERN) }
    : config,
);

export default defineConfig(
  ...baseConfig,
  { ignores: [".output/**/*", ".wrangler/**/*", "dist/**/*", "**/routeTree.gen.ts"] },
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  {
    files: ["src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true, allowExportNames: ["Route"] }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    settings: {
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".tsx", ".json"] })],
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
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": ["error", { ignorePrimitives: { boolean: true } }],
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: ["NotFoundError", "AnyRedirect"] }] },
      ],
    },
  },
);
