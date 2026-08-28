import { Link } from "@tanstack/react-router";

import { CodeBlock } from "#/components/code-block";
import { scrollIntoViewSilently } from "#/lib/audio/scroll";
import { isBrowserHandledClick } from "#/lib/link";

import styles from "./content.module.css";

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
      return (
        <a
          href={href}
          {...props}
          onClick={(event) => {
            if (isBrowserHandledClick(event)) {
              return;
            }

            // The document itself never scrolls, so the browser cannot resolve the
            // fragment. The lookup is scoped to the article because another window may
            // render the same content, and with it the same heading ids.
            const target = event.currentTarget
              .closest("article")
              ?.querySelector<HTMLElement>(`[id="${CSS.escape(href.slice(1))}"]`);

            if (target) {
              event.preventDefault();
              target.focus({ preventScroll: true }); // The scroll below places it.
              scrollIntoViewSilently(target, { block: "start" });
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
