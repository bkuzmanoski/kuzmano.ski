import remarkFrontmatter from "remark-frontmatter";

import { remarkGfmSubset } from "./gfm.ts";

import type { PluggableList } from "unified";

/** Remark plugins for parsing entry MDX frontmatter and the supported GFM subset. */
export const ENTRY_SYNTAX_REMARK_PLUGINS: PluggableList = [remarkFrontmatter, remarkGfmSubset];
