import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const BUILD_IGNORE_PATTERN = "**/build/**";

// TanStack's shared config ignores every `build` directory; in this
// project build/` contains first-party Vite plugins and scripts.
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
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: false, projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      "import-x/resolver-next": [createNodeResolver({ extensions: [".ts", ".tsx", ".json"] })],
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src", from: ["./build"] },
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
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: ["NotFoundError", "AnyRedirect"] }] },
      ],
      // `ignoreIfStatements` avoids introducing `??=` in transformations that React Compiler
      // cannot lower. `||=` is not a workaround: `react-hooks/todo` rejects both operators
      // inside components and hooks. `ignorePrimitives.boolean` preserves `||` for booleans,
      // where replacing it with `??` changes the result for `false`.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignoreIfStatements: true, ignorePrimitives: { boolean: true } },
      ],
      // Compiler diagnostics that `recommended-latest` leaves off. Each one is a React
      // Compiler bailout (the function stays uncompiled and re-renders unmemoized).
      "react-hooks/capitalized-calls": "error",
      "react-hooks/hooks": "error",
      "react-hooks/invariant": "error",
      "react-hooks/memo-dependencies": "error",
      "react-hooks/rule-suppression": "error",
      "react-hooks/syntax": "error",
      "react-hooks/todo": "error",
      "react-hooks/unsupported-syntax": "error",
      // Rules that reject effects that fight memoization by re-running or re-rendering on every commit.
      "react-hooks/exhaustive-effect-dependencies": "error",
      "react-hooks/memoized-effect-dependencies": "error",
      "react-hooks/no-deriving-state-in-effects": "error",
    },
  },
  {
    files: ["src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true, allowExportNames: ["Route"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/routes/api/**", "src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: String.raw`^(#/server/|(\.\./)+server/)`,
              message: "`src/server` may only be imported from a server handler in `src/routes/api/`.",
            },
          ],
        },
      ],
    },
  },
);
