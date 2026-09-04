import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const BUILD_IGNORE_PATTERN = "**/build/**";

// TanStack's shared config ignores every `build` directory; in this project build/` contains first-party Vite plugins and scripts.
const BASE_CONFIG = tanstackConfig.map((config) =>
  config.name === "tanstack/ignores"
    ? { ...config, ignores: config.ignores?.filter((pattern) => pattern !== BUILD_IGNORE_PATTERN) }
    : config,
);

const CONFIG_LAYER_IMPORT_PATTERN = {
  regex: String.raw`^(#/|\.\./)`,
  allowTypeImports: true,
  message: "`/src/config` may import types from other layers, but must not import their code.",
};
const SERVER_IMPORT_PATTERN = {
  regex: String.raw`^(#/server/|(\.\./)+server/|\./server/)`,
  message: "`/src/server` may only be imported by a server handler in `/src/routes/api/`.",
};

// The convention is `#/` across layers and relative within one. `/src/lib` is a single layer spanning
// subdirectories, so it reaches siblings through `../`. Every other layer is one directory deep, so `../`
// leaves it. Each feature directory (`/src/features/<name>`) counts as its own layer.
const LIB_LAYER_IMPORT_PATTERN = {
  regex: String.raw`^#/lib/`,
  message: "Import within `/src/lib` relatively.",
};
const PARENT_IMPORT_PATTERN = {
  regex: String.raw`^\.\./`,
  message: "A relative import must not escape its feature; use `#/` to reach another layer.",
};

// Vite's config loader resolves without a bundler under `configLoader: 'native'`, so every local
// import needs its extension. The rule is repo-wide rather than scoped to the config's module
// graph, because that graph is invisible from any one file. The lookahead reads the extension before
// any `?`, so a query-suffixed specifier such as `#/scripts/theme.ts?inline-script` already satisfies it.
const IMPORT_FILE_EXTENSION_PATTERN = {
  regex: String.raw`^(#/|\.{1,2}/)(?![^?#]*\.[^./?#]+([?#]|$))`,
  message: "Import with the file extension.",
};

// Flat config replaces a rule's options rather than merging them, so the last block matching a file decides
// what that file is checked against. Every list below therefore repeats the patterns of the blocks it shadows.
type ImportPattern = Record<string, unknown>;

const restrictImports = (
  ...patterns: Array<ImportPattern>
): { "@typescript-eslint/no-restricted-imports": ["error", { patterns: Array<ImportPattern> }] } => ({
  "@typescript-eslint/no-restricted-imports": ["error", { patterns }],
});

export default defineConfig(
  ...BASE_CONFIG,
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
      ...restrictImports(IMPORT_FILE_EXTENSION_PATTERN),
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src", from: ["./build"] },
            {
              target: "./src/lib",
              from: [
                "./content",
                "./src/app",
                "./src/components",
                "./src/config",
                "./src/features",
                "./src/routes",
                "./src/site",
                "./src/test-utils/catalog.ts",
                "./src/test-utils/content.ts",
              ],
            },
            {
              target: "./src/components",
              from: ["./src/app", "./src/config", "./src/features", "./src/routes", "./src/site"],
            },
            {
              target: "./src/site",
              from: ["./src/app", "./src/components", "./src/features", "./src/routes"],
            },
            { target: "./src/features", from: ["./src/app", "./src/routes"] },
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
    rules: restrictImports(IMPORT_FILE_EXTENSION_PATTERN, SERVER_IMPORT_PATTERN),
  },
  // Each block from here down must stay after the ones it shadows; see the note beside `restrictImports`.
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/config/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/routes/**/*.{ts,tsx}",
      "src/site/**/*.{ts,tsx}",
      "src/test-utils/**/*.{ts,tsx}",
    ],
    ignores: ["src/routes/api/**"],
    rules: restrictImports(IMPORT_FILE_EXTENSION_PATTERN, SERVER_IMPORT_PATTERN, PARENT_IMPORT_PATTERN),
  },
  // `/src/server` and the API handlers are the two places that may reach into `/src/server`.
  {
    files: ["src/routes/api/**/*.{ts,tsx}", "src/server/**/*.{ts,tsx}"],
    rules: restrictImports(IMPORT_FILE_EXTENSION_PATTERN, PARENT_IMPORT_PATTERN),
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: restrictImports(IMPORT_FILE_EXTENSION_PATTERN, SERVER_IMPORT_PATTERN, LIB_LAYER_IMPORT_PATTERN),
  },
  {
    files: ["src/config/**/*.ts"],
    rules: restrictImports(
      IMPORT_FILE_EXTENSION_PATTERN,
      SERVER_IMPORT_PATTERN,
      PARENT_IMPORT_PATTERN,
      CONFIG_LAYER_IMPORT_PATTERN,
    ),
  },
);
