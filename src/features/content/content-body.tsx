import { MDXProvider } from "@mdx-js/react";
import { Link } from "@tanstack/react-router";
import { use, useMemo, useState } from "react";

import { CopyFailureAlert } from "#/components/copy-failure-alert.tsx";
import { Waitlist } from "#/features/waitlist/waitlist.tsx";
import { playClick } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { RenderedEntryContext } from "#/lib/content/rendered-entry.ts";
import { revealFragmentTarget } from "#/lib/content/reveal-fragment-target.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import type { MDXModule } from "#/site/catalog.ts";

import { CodeBlock } from "./code-block.tsx";
import styles from "./content-body.module.css";
import { HeadingLink } from "./heading-link.tsx";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps, MouseEvent } from "react";

function onLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  if (!isBrowserHandledClick(event)) {
    playClick();
  }
}

const mdxComponents: MDXComponents = {
  h2: (props: ComponentProps<"h2">) => <h2 {...props} tabIndex={-1} />,
  h3: (props: ComponentProps<"h3">) => <h3 {...props} tabIndex={-1} />,
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

            playClick();

            const article = event.currentTarget.closest("article");

            if (article && revealFragmentTarget(article, href)) {
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
        <Link to={href} className={styles.link} {...props} onClick={onLinkClick}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} target="_blank" className={styles.link} {...props} onClick={onLinkClick}>
        {children}
      </a>
    );
  },
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
  Waitlist,
};

function revealInitialFragmentTarget(article: HTMLElement | null) {
  if (article) {
    revealFragmentTarget(article, window.location.hash);
  }
}

export function ContentBody({ route, title, content }: { route: string; title: string; content: Promise<MDXModule> }) {
  const [hasFailedCopy, setHasFailedCopy] = useState(false);
  const renderedEntry = useMemo(() => ({ route, reportCopyFailure: () => setHasFailedCopy(true) }), [route]);
  const { default: MDXContent, className } = use(content); // Read the module with `use()` rather than the route loader as loader data must be serializable.

  return (
    <RenderedEntryContext value={renderedEntry}>
      <MDXProvider components={mdxComponents}>
        <article ref={revealInitialFragmentTarget} className={cx(styles.content, className)}>
          <h1 data-feed-omit>{title}</h1>
          <MDXContent />
        </article>
      </MDXProvider>
      <CopyFailureAlert entity="link" open={hasFailedCopy} onDismiss={() => setHasFailedCopy(false)} />
    </RenderedEntryContext>
  );
}
