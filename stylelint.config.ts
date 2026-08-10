import type { Config } from "stylelint";

export default {
  extends: ["stylelint-config-standard", "stylelint-config-clean-order"],
  ignoreFiles: [".output/**/*", "dist/**/*"],
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  plugins: ["stylelint-value-no-unknown-custom-properties"],
  rules: {
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]*$|^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }],
    "property-no-unknown": [true, { ignoreProperties: ["composes"] }], // `composes` is CSS modules syntax (see `shared.module.css`), not a real property.
    "value-keyword-case": [
      "lower",
      { ignoreProperties: ["composes", "/font-family/"], ignoreKeywords: ["currentColor"] },
    ],
    "csstools/value-no-unknown-custom-properties": [true, { importFrom: ["./src/styles.css"] }],
  },
} satisfies Config;
