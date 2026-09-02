import { MDXProvider } from "@mdx-js/react";
import { Link } from "@tanstack/react-router";
import { use, useMemo, useState } from "react";

import { CodeBlock } from "#/components/code-block";
import { CopyFailureAlert } from "#/components/copy-feedback";
import { HeadingLink } from "#/components/heading-link";
import { Waitlist } from "#/components/waitlist";
import { ArticleContext } from "#/lib/article-context";
import { cx } from "#/lib/class-names";
import { isBrowserHandledClick } from "#/lib/link";
import { revealFragment } from "#/lib/reveal-fragment";
import type { MDXModule } from "#/site/catalog";

import styles from "./content-body.module.css";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

const mdxComponents: MDXComponents = {
  h2: (props: ComponentProps<"h2">) => <h2 {...props} tabIndex={-1} />,
  a: ({ href, children, ...props }: ComponentProps<"a">) => {
    if (href?.startsWith("#")) {
      return "data-heading-link" in props ? (
        <HeadingLink href={href} {...props}>
          {children}
        </HeadingLink>
      ) : (
        <a
          href={href}
          className={styles.link}
          {...props}
          onClick={(event) => {
            if (isBrowserHandledClick(event)) {
              return;
            }

            const article = event.currentTarget.closest("article");

            if (article && revealFragment(article, href)) {
              event.preventDefault();
            }
          }}
        >
          {children}
        </a>
      );
    }

    if (href?.startsWith("/")) {
      return (
        <Link to={href} className={styles.link} {...props}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} target="_blank" className={styles.link} {...props}>
        {children}
      </a>
    );
  },
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
  Waitlist,
};

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
