import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import type { Collection, Frontmatter } from "#/content";

import { mdxComponents } from "./mdx-components";

interface PostProps {
  collection: Collection;
  slug: string;
  frontmatter: Frontmatter;
}

export function Post({ collection, slug, frontmatter }: PostProps) {
  const { default: Content } = use(collection.module(slug)); // Read with `use()` rather than the route loader because loader data must be serializable.

  return (
    <main>
      <h1>{frontmatter.title}</h1>
      <time dateTime={frontmatter.date}>{frontmatter.date}</time>
      <MDXProvider components={mdxComponents}>
        <Content />
      </MDXProvider>
    </main>
  );
}
