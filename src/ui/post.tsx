import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import type { Collection, Frontmatter } from "#/content";

import { mdxComponents } from "./mdx-components";

interface PostProps {
  collection: Collection;
  slug: string;
  frontmatter: Frontmatter;
  showDate?: boolean;
}

/**
 * Renders a post body. The compiled MDX is read with `use()` rather than handed
 * over by the route loader, because loader data must be serializable and a React
 * component is not.
 */
export function Post({ collection, slug, frontmatter, showDate = false }: PostProps) {
  const { default: Content } = use(collection.module(slug));

  return (
    <main>
      <h1>{frontmatter.title}</h1>
      {showDate && <time dateTime={frontmatter.date}>{frontmatter.date}</time>}
      <MDXProvider components={mdxComponents}>
        <Content />
      </MDXProvider>
    </main>
  );
}
