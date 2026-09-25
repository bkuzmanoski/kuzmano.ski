import { gfmAutolinkLiteralFromMarkdown, gfmAutolinkLiteralToMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmTableFromMarkdown, gfmTableToMarkdown } from "mdast-util-gfm-table";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmTable } from "micromark-extension-gfm-table";

import type { Processor } from "unified";

/**
 * Parses and serializes GFM tables, autolink literals, and strikethrough. The MDX pipeline and the
 * Markdown pass both use this plugin, so an entry is parsed the same way for its document and its
 * Markdown representation.
 *
 * This composes the individual extensions rather than using `remark-gfm`, which also enables
 * footnotes and task lists.
 */
export function remarkGfmSubset(this: Processor) {
  const data = this.data();

  (data.micromarkExtensions ??= []).push(
    gfmTable(),
    gfmAutolinkLiteral(),
    gfmStrikethrough({ singleTilde: false }), // Only `~~` marks strikethrough, so an approximation such as "~5 to ~10" remains prose.
  );
  (data.fromMarkdownExtensions ??= []).push(
    gfmTableFromMarkdown(),
    gfmAutolinkLiteralFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
  );
  (data.toMarkdownExtensions ??= []).push(
    gfmTableToMarkdown(),
    gfmAutolinkLiteralToMarkdown(),
    gfmStrikethroughToMarkdown(),
  );
}
