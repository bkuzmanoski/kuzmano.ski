import { Link, useRouter } from "@tanstack/react-router";

import { useRenderedEntry } from "#/lib/content/rendered-entry.ts";
import { isBrowserHandledClick, linkDestinationOf, sitePathPartsOf } from "#/lib/link.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";

import { useOpensInNewTabDescriptionId } from "./opens-in-new-tab-description.ts";
import { revealFragmentTarget } from "./reveal-fragment-target.ts";

import type { ComponentProps, MouseEvent } from "react";

function revealContentLinkTarget(event: MouseEvent<HTMLAnchorElement>, fragment: string) {
  if (isBrowserHandledClick(event)) {
    return;
  }

  const article = event.currentTarget.closest("article");

  if (article && revealFragmentTarget(article, fragment)) {
    event.preventDefault();
  }
}

export function ContentLink({
  href,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href" | "target" | "onClick"> & { href: string }) {
  const opensInNewTabDescriptionId = useOpensInNewTabDescriptionId();
  const router = useRouter();
  const renderedEntry = useRenderedEntry();
  const pressSoundHandlers = usePressSound({ defersTouchPressSound: true, silencesBrowserHandledPress: true });

  const linkProps = mergeHandlers(pressSoundHandlers, props);

  switch (linkDestinationOf(href)) {
    case "fragment":
      return (
        <a
          href={href}
          {...linkProps}
          onClick={(event) => {
            linkProps.onClick(event);
            revealContentLinkTarget(event, href);
          }}
        >
          {children}
        </a>
      );

    case "site": {
      const { pathname, search, hash } = sitePathPartsOf(href);
      return (
        // The router matches `to` as a pathname only, so a query string or fragment left in it would be matched as part
        // of the path, and the preload on hover or focus would load another route, or none. The parts are passed
        // separately instead.
        <Link
          to={pathname}
          search={router.options.parseSearch(search)}
          hash={hash.slice(1)}
          // Turning off `hashScrollIntoView` keeps the router's own scroll from aligning a footnote to the top after
          // `ContentBody` runs.
          hashScrollIntoView={false}
          activeOptions={{ exact: true }}
          {...linkProps}
          onClick={(event) => {
            linkProps.onClick(event);

            if (
              hash &&
              router.buildLocation({ to: pathname }).pathname === renderedEntry?.route &&
              search === router.state.location.searchStr
            ) {
              revealContentLinkTarget(event, hash);
            }
          }}
        >
          {children}
        </Link>
      );
    }

    case "file":
    case "external":
      return (
        <a href={href} target="_blank" aria-describedby={opensInNewTabDescriptionId} {...linkProps}>
          {children}
        </a>
      );

    case "other":
      return (
        <a href={href} {...linkProps}>
          {children}
        </a>
      );
  }
}
