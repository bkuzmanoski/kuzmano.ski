import { MDXProvider } from "@mdx-js/react";
import { use, useMemo, useState } from "react";

import { CopyFailureAlert } from "#/components/copy-feedback";
import type { MDXModule } from "#/content";
import { ArticleContext } from "#/content/article-context";
import styles from "#/content/content.module.css";
import { revealFragment } from "#/content/fragment";
import { mdxComponents } from "#/content/mdx-components";
import { cx } from "#/lib/class-names";

function revealInitialFragment(article: HTMLElement | null) {
  if (article) {
    revealFragment(article, window.location.hash);
  }
}

export function ContentBody({ route, title, content }: { route: string; title: string; content: Promise<MDXModule> }) {
  const [hasFailedCopy, setHasFailedCopy] = useState(false);
  const article = useMemo(() => ({ route, reportCopyFailure: () => setHasFailedCopy(true) }), [route]);
  const { default: MDXContent, className } = use(content); // Read the module with `use()` rather than the route loader as loader data must be serializable.

  return (
    <ArticleContext value={article}>
      <MDXProvider components={mdxComponents}>
        {/* `className` is the class a page exports to apply a stylesheet of its own on top of the shared one. */}
        <article ref={revealInitialFragment} className={cx(styles.content, className)}>
          <h1 data-feed-omit>{title}</h1>
          <MDXContent />
        </article>
      </MDXProvider>
      <CopyFailureAlert entity="link" open={hasFailedCopy} onDismiss={() => setHasFailedCopy(false)} />
    </ArticleContext>
  );
}
