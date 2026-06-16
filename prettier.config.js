//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  overrides: [
    {
      files: "*.svg",
      options: { parser: "html" },
    },
  ],
  printWidth: 120,
};
