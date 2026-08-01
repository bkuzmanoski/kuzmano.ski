import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import type { Frontmatter } from "#/content";
import { mdxComponents } from "#/content/mdx-components";

import type { MDXContent } from "mdx/types";

export function ContentBody({
  frontmatter,
  content,
  showDate = true,
}: {
  frontmatter: Frontmatter;
  content: Promise<{ default: MDXContent }>;
  showDate?: boolean;
}) {
  // Read the module with `use()` rather than the route loader as loader data must be serializable.
  const { default: MDXContent } = use(content);

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      {showDate && <time dateTime={frontmatter.date}>{frontmatter.date}</time>}
      <MDXProvider components={mdxComponents}>
        <MDXContent />
      </MDXProvider>
    </article>
  );
}
