import { Link, useRouter } from "@tanstack/react-router";
import { createContext, use, useId } from "react";

import { playClick } from "#/lib/audio/sounds.ts";
import { revealFragmentTarget } from "#/lib/content/reveal-fragment-target.ts";
import { isBrowserHandledClick, linkDestinationOf, sitePathPartsOf } from "#/lib/link.ts";

import type { ComponentProps, MouseEvent, ReactNode } from "react";

const OpensInNewTabDescriptionIdContext = createContext<string | undefined>(undefined);

function playContentLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  if (!isBrowserHandledClick(event)) {
    playClick();
  }
}

function revealContentLinkTarget(event: MouseEvent<HTMLAnchorElement>, fragment: string) {
  if (isBrowserHandledClick(event)) {
    return;
  }

  playClick();

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
  const opensInNewTabDescriptionId = use(OpensInNewTabDescriptionIdContext);
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
          {...props}
          onClick={playContentLinkClick}
        >
          {children}
        </Link>
      );
    }

    case "external":
      return (
        <a
          href={href}
          target="_blank"
          aria-describedby={opensInNewTabDescriptionId}
          {...props}
          onClick={playContentLinkClick}
        >
          {children}
        </a>
      );

    case "other":
      return (
        <a href={href} {...props} onClick={playContentLinkClick}>
          {children}
        </a>
      );
  }
}

/**
 * Renders a shared "Opens in a new tab" description, which every `ContentLink` to another
 * site references through `aria-describedby`.
 */
export function OpensInNewTabDescriptionProvider({ children }: { children: ReactNode }) {
  const id = useId();
  return (
    <OpensInNewTabDescriptionIdContext value={id}>
      {children}
      <span id={id} hidden>
        Opens in a new tab
      </span>
    </OpensInNewTabDescriptionIdContext>
  );
}
