// @ts-check

/** @type {import('prettier').Config} */
export default {
  overrides: [
    { files: "*.jsonc", options: { trailingComma: "none" } },
    { files: "*.svg", options: { parser: "html" } },
  ],
  printWidth: 120,
};
