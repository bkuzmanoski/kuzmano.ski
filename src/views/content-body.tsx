import { MDXProvider } from "@mdx-js/react";
import { use } from "react";

import type { MDXModule } from "#/content";
import styles from "#/content/content.module.css";
import { mdxComponents } from "#/content/mdx-components";
import { cx } from "#/lib/class-names";

export function ContentBody({ content }: { content: Promise<MDXModule> }) {
  const { default: MDXContent, className } = use(content); // Read the module with `use()` rather than the route loader as loader data must be serializable.

  return (
    <MDXProvider components={mdxComponents}>
      {/* `className` is the class a page exports to apply a stylesheet of its own on top of the shared one. */}
      <article className={cx(styles.content, className)}>
        <MDXContent />
      </article>
    </MDXProvider>
  );
}
