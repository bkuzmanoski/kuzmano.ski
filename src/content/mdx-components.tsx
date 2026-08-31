import { Link } from "@tanstack/react-router";

import { CodeBlock } from "#/components/code-block";
import { isBrowserHandledClick } from "#/lib/link";

import { HeadingLink } from "../components/heading-link";

import styles from "./content.module.css";
import { revealFragment } from "./fragment";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

type HeadingTag = "h1" | "h2";

const heading = (Tag: HeadingTag) =>
  function Heading(props: ComponentProps<"h1">) {
    return <Tag {...props} tabIndex={-1} />;
  };

export const mdxComponents: MDXComponents = {
  h1: heading("h1"),
  h2: heading("h2"),
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
  pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} containerClassName={styles.codeBlock} />,
};
