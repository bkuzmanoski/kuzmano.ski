import { Link } from "@tanstack/react-router";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

export const mdxComponents: MDXComponents = {
  a: ({ href, children, ...props }: ComponentProps<"a">) => {
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
