import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import type { Collection, Frontmatter } from "#/content";
import { mdxComponents } from "#/content/mdx-components";

interface PostProps {
  collection: Collection;
  slug: string;
  frontmatter: Frontmatter;
}

export function Post({ collection, slug, frontmatter }: PostProps) {
  // Read the module with `use()` and not with the route loader. Loader data must be serializable.
  const { default: Content } = use(collection.module(slug));

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <time dateTime={frontmatter.date}>{frontmatter.date}</time>
      <MDXProvider components={mdxComponents}>
        <Content />
      </MDXProvider>
    </article>
  );
}
