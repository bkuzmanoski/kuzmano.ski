import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import { mdxComponents } from "#/content/mdx-components";

import type { MDXContent } from "mdx/types";

export function ContentBody({ content }: { content: Promise<{ default: MDXContent }> }) {
  // Read the module with `use()` rather than the route loader as loader data must be serializable.
  const { default: MDXContent } = use(content);

  return (
    <article>
      <MDXProvider components={mdxComponents}>
        <MDXContent />
      </MDXProvider>
    </article>
  );
}
