import { Link } from "@tanstack/react-router";

import { isBrowserHandledClick } from "#/lib/link";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * Renders a heading as its own fragment target.
 *
 * `rehype-slug` gives every heading an id, which a link can address. A target has to be
 * focusable for the keyboard to follow the link to it, and `-1` grants that without
 * putting every heading in the tab order.
 */
const heading = (Tag: HeadingTag) =>
  function Heading(props: ComponentProps<"h1">) {
    return <Tag {...props} tabIndex={-1} />;
  };

export const mdxComponents: MDXComponents = {
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
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
              target.scrollIntoView();
              target.focus({ preventScroll: true }); // The pane is already scrolling to it.
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
};
