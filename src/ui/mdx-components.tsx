import { Link } from "@tanstack/react-router";

import type { MDXComponents } from "mdx/types";

export const mdxComponents: MDXComponents = {
  a: ({ href, children, ...props }) => {
    if (href && href.startsWith("/")) {
      return (
        <Link to={href} {...props}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} rel="noreferrer noopener" target="_blank" {...props}>
        {children}
      </a>
    );
  },
};
