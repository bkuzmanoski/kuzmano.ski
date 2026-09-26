import cleanOrderConfig from "stylelint-config-clean-order";

import type { Config } from "stylelint";

const [cleanOrder, cleanOrderOptions] = cleanOrderConfig.rules["order/order"] as [Array<unknown>, object];

// Blockless mixins come before declarations so declarations can override them. Block mixins wrap rules
// in a condition (see `/src/mixins.css`), so they remain in place like `@container`.
const order = cleanOrder.map((item) =>
  typeof item === "object" && item !== null && "name" in item && item.name === "mixin"
    ? { ...item, hasBlock: false }
    : item,
);

export default {
  extends: ["stylelint-config-standard", "stylelint-config-clean-order"],
  ignoreFiles: [".output/**/*", "dist/**/*"],
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  plugins: ["stylelint-value-no-unknown-custom-properties"],
  rules: {
    "property-disallowed-list": ["scroll-behavior"], // Incompatible with the scroll sounds implementation (see `/src/lib/audio/scroll.ts`).
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]*$|^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }],
    "at-rule-no-unknown": [true, { ignoreAtRules: ["define-mixin", "mixin", "mixin-content"] }], // postcss-mixins syntax (see `/src/mixins.css`).
    "order/order": [order, cleanOrderOptions],
    "property-no-unknown": [true, { ignoreProperties: ["composes"] }], // CSS modules syntax.
    "value-keyword-case": ["lower", { ignoreProperties: ["composes", "/font/"], ignoreKeywords: ["currentColor"] }],
    "csstools/value-no-unknown-custom-properties": [
      true,
      {
        importFrom: [
          "./src/styles.css",
          "./src/mixins.css",
          "./src/features/content/content-body.module.css",
          "./src/features/window-manager/window-layer.module.css",
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["src/mixins.css"],
      rules: { "no-invalid-position-declaration": null, "nesting-selector-no-missing-scoping-root": null }, // A mixin body is inlined into the including rule, so its declarations and `&` have no enclosing rule.
    },
  ],
} satisfies Config;
