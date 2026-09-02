import { Link } from "@tanstack/react-router";

import { CodeBlock } from "#/components/code-block";
import { HeadingLink } from "#/components/heading-link";
import { Waitlist } from "#/components/waitlist";
import { isBrowserHandledClick } from "#/lib/link";
import { revealFragment } from "#/lib/reveal-fragment";

import styles from "./content-body.module.css";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

export const mdxComponents: MDXComponents = {
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
