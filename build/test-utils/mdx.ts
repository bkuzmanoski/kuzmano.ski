import { compile } from "@mdx-js/mdx";

import { mdxCompileOptionsFor } from "../content/mdx.ts";

import type { ContentParent } from "../content/markup/tree.ts";

/** Returns the hast tree that the MDX pipeline produces for `source`, after every rehype plugin of an entry has run. */
export async function transformedTreeOf(source: string): Promise<ContentParent> {
  const compileOptions = mdxCompileOptionsFor({ syntaxHighlight: false });

  let transformedTree: ContentParent = { type: "root", children: [] };

  const capture = () => (tree: ContentParent) => {
    transformedTree = tree;
  };

  await compile(source, { ...compileOptions, rehypePlugins: [...(compileOptions.rehypePlugins ?? []), capture] });

  return transformedTree;
}
