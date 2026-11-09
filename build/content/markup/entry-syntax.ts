import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { remarkGfmSubset } from "./gfm.ts";

import type { PluggableList } from "unified";

/** Remark plugins for parsing an entry's body (the supported GFM subset). */
const ENTRY_BODY_REMARK_PLUGINS: PluggableList = [remarkGfmSubset];

/** Remark plugins for parsing entry MDX frontmatter and the supported GFM subset. */
export const ENTRY_SYNTAX_REMARK_PLUGINS: PluggableList = [remarkFrontmatter, ...ENTRY_BODY_REMARK_PLUGINS];

/** Parses entries with the same MDX pipeline used for compilation. Call it for an unfrozen, extensible processor. */
export const entryParser = unified().use(remarkParse).use(remarkMdx).use(ENTRY_SYNTAX_REMARK_PLUGINS).freeze();

/**
 * Parses an entry's body as `entryParser` does, without `remarkFrontmatter`, for a markdownlint rule. markdownlint
 * leaves the frontmatter out of the lines it passes a rule, so a thematic break that starts those lines would otherwise
 * parse as frontmatter.
 */
export const entryBodyParser = unified().use(remarkParse).use(remarkMdx).use(ENTRY_BODY_REMARK_PLUGINS).freeze();
