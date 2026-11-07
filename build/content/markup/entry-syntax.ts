import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { remarkGfmSubset } from "./gfm.ts";

import type { PluggableList } from "unified";

/** Remark plugins for parsing entry MDX frontmatter and the supported GFM subset. */
export const ENTRY_SYNTAX_REMARK_PLUGINS: PluggableList = [remarkFrontmatter, remarkGfmSubset];

/** Parses entries with the same MDX pipeline used for compilation. Call it for an unfrozen, extensible processor. */
export const entryParser = unified().use(remarkParse).use(remarkMdx).use(ENTRY_SYNTAX_REMARK_PLUGINS).freeze();
