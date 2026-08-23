import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import { mdxComponents } from "#/content/mdx-components";

import type { MDXContent } from "mdx/types";

export function ContentBody({ content }: { content: Promise<{ default: MDXContent }> }) {
  const { default: MDXContent } = use(content); // Read the module with `use()` rather than the route loader as loader data must be serializable.

  return (
    <MDXProvider components={mdxComponents}>
      <article>
        <MDXContent />
      </article>
    </MDXProvider>
  );
}
