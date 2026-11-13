import { tanstackConfig } from "@tanstack/eslint-config";
import { defineConfig } from "eslint/config";
import { createNodeResolver } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

import type { Linter } from "eslint";

const BASE_CONFIG: Array<Linter.Config> = tanstackConfig.map((config) =>
  config.name === "tanstack/ignores"
    ? { ...config, ignores: config.ignores?.filter((pattern) => pattern !== "**/build/**") } // `/build` contains first-party Vite plugins and scripts.
    : config,
);

interface ImportPattern {
  regex: string;
  message: string;
  allowTypeImports?: boolean;
}

/**
 * Rejects a relative import that leaves its layer, since imports use `#/` across layers and relative paths within one.
 * Every layer except `/src/lib` is one directory deep, so `../` escapes it. A separate restriction covers `/src/lib`.
 */
const CROSS_LAYER_RELATIVE_IMPORT_RESTRICTION: ImportPattern = {
  regex: String.raw`^\.\./`,
  message: "Relative imports must remain within their feature; use `#/` to access another layer.",
};

const SERVER_MODULE_IMPORT_RESTRICTION: ImportPattern = {
  regex: String.raw`^(#/server/|(\.\./)+server/|\./server/)`,
  message: "`/src/server` may only be imported by the Worker entry or an API handler in `/src/routes/api`.",
};

const FILE_EXTENSION_IMPORT_RESTRICTION: ImportPattern = {
  regex: String.raw`^(#/|\.{1,2}/)(?![^?#]*\.[^./?#]+([?#]|$))`, // The lookahead skips a `?query` suffix.
  message: "Include the file extension in imports.",
};

interface ImportRestrictionGroup {
  files: Array<string>;
  /** Additional patterns (besides `FILE_EXTENSION_IMPORT_RESTRICTION` which applies to every file). */
  patterns: Array<ImportPattern>;
}

/**
 * Import patterns prohibited for each file group. Files use only the patterns from the first matching group, so each
 * group must list all restrictions that apply rather than relying on a broader group.
 */
const IMPORT_RESTRICTION_GROUPS: Array<ImportRestrictionGroup> = [
  {
    files: ["src/routes/api/**/*.{ts,tsx}", "src/server/**/*.{ts,tsx}", "src/worker.ts"],
    patterns: [CROSS_LAYER_RELATIVE_IMPORT_RESTRICTION],
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    patterns: [
      { regex: String.raw`^#/lib/`, message: "Use relative imports within `/src/lib`." },
      SERVER_MODULE_IMPORT_RESTRICTION,
    ],
  },
  {
    files: ["src/config/**/*.{ts,tsx}"],
    patterns: [
      {
        regex: String.raw`^(#/(?!server/)|\.\./)`, // The pattern that allows types leaves out `server/`, as in the `/content` group below.
        allowTypeImports: true,
        message: "`/src/config` may import types from other layers, but must not import their code.",
      },
      CROSS_LAYER_RELATIVE_IMPORT_RESTRICTION,
      SERVER_MODULE_IMPORT_RESTRICTION,
    ],
  },
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/routes/**/*.{ts,tsx}",
      "src/site/**/*.{ts,tsx}",
      "src/test-utils/**/*.{ts,tsx}",
    ],
    patterns: [CROSS_LAYER_RELATIVE_IMPORT_RESTRICTION, SERVER_MODULE_IMPORT_RESTRICTION],
  },
  {
    files: ["src/api-routes.ts"],
    patterns: [
      // All layers can read `/src/api-routes.ts`, but importing the route tree's value would bundle every route into
      // each `lib/*/client.ts` consumer.
      {
        regex: String.raw`^(#/|\./)routeTree\.gen\.ts$`,
        allowTypeImports: true,
        message: "`/src/api-routes.ts` may import the route tree's types, but must not import its value.",
      },
      SERVER_MODULE_IMPORT_RESTRICTION,
    ],
  },
  { files: ["src/**/*.{ts,tsx}"], patterns: [SERVER_MODULE_IMPORT_RESTRICTION] },
  {
    // `/build/markdown` evaluates entry data files in Vite's process, so any `/src` code they import runs there too.
    // The type-only exception excludes `server/`, because ESLint does not apply the server restriction to type imports.
    files: ["content/**/*.ts"],
    patterns: [
      {
        regex: String.raw`^#/(?!server/)`,
        allowTypeImports: true,
        message: "`/content` may import types from `/src`, but must not import its code.",
      },
      {
        regex: String.raw`^(\.\./)+(build|scripts|src)/`,
        message: "Use `#/` to import from `/src`; `/content` must not import `/build` or `/scripts`.",
      },
      SERVER_MODULE_IMPORT_RESTRICTION,
    ],
  },
  { files: ["**/*.{ts,tsx}"], patterns: [] },
];

/**
 * Each group gets its own config block and ignores files matched by earlier groups, ensuring that each file matches
 * only one block. Because flat config replaces rather than merges rule options, overlapping blocks would be
 * order-dependent.
 */
const IMPORT_RESTRICTION_BLOCKS: Array<Linter.Config> = IMPORT_RESTRICTION_GROUPS.map(({ files, patterns }, index) => ({
  files,
  ignores: IMPORT_RESTRICTION_GROUPS.slice(0, index).flatMap((earlierGroup) => earlierGroup.files),
  rules: {
    "@typescript-eslint/no-restricted-imports": [
      "error",
      { patterns: [FILE_EXTENSION_IMPORT_RESTRICTION, ...patterns] },
    ],
  },
}));

export default defineConfig(
  {
    ignores: [".output/**/*", ".wrangler/**/*", "dist/**/*", "generated/**/*", "**/routeTree.gen.ts", "**/*.tmp/**/*"],
  },
  ...BASE_CONFIG,
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
      "import/no-extraneous-dependencies": ["error", { devDependencies: true, includeTypes: true }],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./build", from: ["./scripts"] },
            { target: "./build/content/markup", from: ["./build/content/media"] }, // `/build/content/markup` only walks syntax trees. `vitest.config.ts` reaches it through the MDX plugin, so an import of the media pipeline from it would load sharp into every test run.
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
              ],
            },
            // `/src/test-utils` is unlayered, so helpers can otherwise leak imports above `lib` into every `lib` test.
            // Listing exemptions here keeps new helpers restricted until explicitly approved.
            {
              target: "./src/lib",
              from: ["./src/test-utils"],
              except: [
                "./audio.ts",
                "./clipboard.ts",
                "./collection.ts",
                "./content-source.ts",
                "./fetch.ts",
                "./fixtures",
                "./geometry.ts",
                "./match-media.ts",
                "./press.ts",
                "./resize-observer.ts",
                "./router-context.tsx",
                "./timers.ts",
                "./window-manager.ts",
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
            // Layers must not import the composition root, hydration entry, or route tree as that would pull in the
            // entire app graph and load React in `/src/scripts`.
            {
              target: [
                "./src/app",
                "./src/components",
                "./src/config",
                "./src/features",
                "./src/lib",
                "./src/routes",
                "./src/scripts",
                "./src/server",
                "./src/site",
                // The list leaves out `/src/test-utils`, which mounts the real router, and `/src/api-routes.ts`, which
                // only enumerates route paths.
              ],
              from: ["./src/client.tsx", "./src/router.tsx", "./src/routeTree.gen.ts"],
            },
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
      // `ignoreIfStatements` avoids introducing `??=` in transformations that React Compiler cannot lower. `||=` is not
      // a workaround: `react-hooks/todo` rejects both operators inside components and hooks. `ignorePrimitives.boolean`
      // preserves `||` for booleans, where replacing it with `??` changes the result for `false`.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignoreIfStatements: true, ignorePrimitives: { boolean: true } },
      ],
      // Compiler diagnostics that `recommended-latest` leaves off. Each one identifies a React Compiler optimization
      // failure, so the function is not compiled and re-renders without memoization.
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
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["src/**/*.test.{ts,tsx}", "src/test-utils/**/*.{ts,tsx}", "src/server/env.ts"], // `/src/server/env.ts` imports `wrangler` only under `vite dev`, to read the bindings from its platform proxy.
          includeTypes: true,
        },
      ],
    },
  },
  ...IMPORT_RESTRICTION_BLOCKS,
);
