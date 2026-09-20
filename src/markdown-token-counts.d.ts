/** The estimated token count of each Markdown file the build emits. */
declare module "virtual:markdown-token-counts" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- A top-level import would make this an invalid module augmentation.
  export const MARKDOWN_TOKEN_COUNTS: import("../build/markdown/token-count.ts").MarkdownTokenCounts;
}
