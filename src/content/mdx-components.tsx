import { Link } from "@tanstack/react-router";

import { CodeBlock } from "#/components/code-block";
import { isBrowserHandledClick } from "#/lib/link";

import styles from "./content.module.css";
import { revealFragment } from "./fragment";
import { HeadingLink } from "./heading-link";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

type HeadingTag = "h1" | "h2" | "h3";

const heading = (Tag: HeadingTag) =>
  function Heading(props: ComponentProps<"h1">) {
    return <Tag {...props} tabIndex={-1} />;
  };

export const mdxComponents: MDXComponents = {
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  a: ({ href, children, ...props }: ComponentProps<"a">) => {
    if (href?.startsWith("#")) {
      return "data-heading-link" in props ? (
        <HeadingLink href={href} {...props}>
          {children}
        </HeadingLink>
      ) : (
        <a
          href={href}
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
        <Link to={href} {...props}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} target="_blank" {...props}>
        {children}
      </a>
    );
  },
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} containerClassName={styles.codeBlock} />,
};
