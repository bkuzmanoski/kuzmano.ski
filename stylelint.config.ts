import type { Config } from "stylelint";

export default {
  extends: ["stylelint-config-standard", "stylelint-config-clean-order"],
  ignoreFiles: [".output/**/*", "dist/**/*"],
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  plugins: ["stylelint-value-no-unknown-custom-properties"],
  languageOptions: {
    syntax: {
      properties: { "mix-blend-mode": "| plus-darker" },
    },
  },
  rules: {
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]*$|^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }],
    "value-keyword-case": ["lower", { ignoreProperties: ["/font-family/"] }],
    "csstools/value-no-unknown-custom-properties": [true, { importFrom: ["./src/styles.css"] }],
  },
} satisfies Config;
