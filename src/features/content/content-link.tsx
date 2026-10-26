import { Link, useRouter } from "@tanstack/react-router";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { revealFragmentTarget } from "#/lib/content/reveal-fragment-target.ts";
import { isBrowserHandledClick, linkDestinationOf, sitePathPartsOf } from "#/lib/link.ts";

import { useOpensInNewTabDescriptionId } from "./opens-in-new-tab-description.ts";

import type { ComponentProps, MouseEvent } from "react";

function playContentLinkClickSound(event: MouseEvent<HTMLAnchorElement>) {
  if (!isBrowserHandledClick(event)) {
    playClickSound();
  }
}

function revealContentLinkTarget(event: MouseEvent<HTMLAnchorElement>, fragment: string) {
  if (isBrowserHandledClick(event)) {
    return;
  }

  playClickSound();

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

  switch (linkDestinationOf(href)) {
    case "fragment":
      return (
        <a href={href} {...props} onClick={(event) => revealContentLinkTarget(event, href)}>
          {children}
        </a>
      );

    case "site": {
      const { pathname, search, hash } = sitePathPartsOf(href);
      return (
        // The router matches `to` as a pathname only, so a query string or fragment left in it would be
        // matched as part of the path, and the preload on hover or focus would load another route, or none.
        // The parts are passed separately instead.
        <Link
          to={pathname}
          search={router.options.parseSearch(search)}
          hash={hash.slice(1)}
          activeOptions={{ exact: true }}
          {...props}
          onClick={playContentLinkClickSound}
        >
          {children}
        </Link>
      );
    }

    case "file":
    case "external":
      return (
        <a
          href={href}
          target="_blank"
          aria-describedby={opensInNewTabDescriptionId}
          {...props}
          onClick={playContentLinkClickSound}
        >
          {children}
        </a>
      );

    case "other":
      return (
        <a href={href} {...props} onClick={playContentLinkClickSound}>
          {children}
        </a>
      );
  }
}
