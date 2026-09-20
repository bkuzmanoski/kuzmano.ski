/**
 * The paths that have a Markdown representation, each mapped to the estimated token count
 * of the file served from it. A path absent from the map has no Markdown representation.
 */
export type MarkdownTokenCounts = Record<string, number>;

const CHARACTERS_PER_TOKEN = 4;
const TOKEN_RUN = /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;

/** Returns an estimated token count for the given text. */
export function estimatedTokenCountIn(text: string): number {
  let tokenCount = 0;

  for (const [run] of text.matchAll(TOKEN_RUN)) {
    tokenCount += Math.max(1, Math.round(run.length / CHARACTERS_PER_TOKEN));
  }

  return tokenCount;
}

/** Returns the estimated token count of each rendered Markdown file, keyed by the path it is served from. */
export const estimatedTokenCountsOf = (files: Map<string, string>): MarkdownTokenCounts =>
  Object.fromEntries([...files].map(([path, markdown]) => [path, estimatedTokenCountIn(markdown)]));
