import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Whether a click repeats one the browser has already acted on (e.g., the second of a double
 * click). `detail` contains the running count of the sequence.
 */
export function isRepeatClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail > 1;
}

/**
 * Whether a click on a link requires the browser's own handling of the href (e.g.
 * opening in a new tab or window, or downloading the resource).
 */
export function isBrowserHandledClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Opens a link's destination in the app in place of the browser loading it, unless the click is
 * one the browser handles itself, such as a click that opens the link in a new tab.
 */
export function openInAppOnPlainClick(event: ReactMouseEvent, openInApp: () => void) {
  if (isBrowserHandledClick(event)) {
    return;
  }

  event.preventDefault();
  openInApp();
}

const PLACEHOLDER_ORIGIN = "https://placeholder.origin";

// Resolves `value` against a placeholder origin, as a browser resolves an `href` against the document,
// or returns `null` when it is not a valid URL.
function resolvedAgainstSiteOrigin(value: string): URL | null {
  try {
    return new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
}

/**
 * Whether `value` is a path on this site: it starts with `/`, and resolving it against an origin
 * produces a URL on that origin.
 *
 * Resolving it also rejects the values a URL parser resolves to another host that a check of the
 * first two characters misses: `/\host`, and `//host` with a tab or a newline between the slashes,
 * which the parser removes.
 */
export function isSitePath(value: string): boolean {
  return value.startsWith("/") && resolvedAgainstSiteOrigin(value)?.origin === PLACEHOLDER_ORIGIN;
}

/** The pathname, query string, and fragment of a path on this site (see `isSitePath`), as a URL parser splits them. */
export function sitePathPartsOf(sitePath: string): { pathname: string; search: string; hash: string } {
  const { pathname, search, hash } = new URL(sitePath, PLACEHOLDER_ORIGIN);
  return { pathname, search, hash };
}

/**
 * Where an `href` leads: an element in the same document, a path on this site, a page on another
 * site, or anything else, such as a `mailto:` or `tel:` URL, which the browser hands to another
 * application rather than loading as a page.
 */
export type LinkDestination = "fragment" | "site" | "external" | "other";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Classifies an `href` by the URL a browser resolves it to, so an `href` the parser resolves to
 * another host, such as `/\host`, is `external` rather than a path. A relative path, such as
 * `entry`, is `other`, since it resolves against the document rather than naming a route.
 */
export function linkDestinationOf(href: string): LinkDestination {
  if (href.startsWith("#")) {
    return "fragment";
  }

  if (isSitePath(href)) {
    return "site";
  }

  const url = resolvedAgainstSiteOrigin(href);

  return url !== null && WEB_PROTOCOLS.has(url.protocol) && url.origin !== PLACEHOLDER_ORIGIN ? "external" : "other";
}

/** Follows a link from code, for UI that defers activation past the original click. */
export function followLink(element: HTMLAnchorElement | null | undefined) {
  if (!element) {
    return;
  }

  element.dataset.following = "";

  try {
    element.click();
  } finally {
    delete element.dataset.following;
  }
}

/**
 * Whether the click being handled on an element originated from `followLink` rather than
 * from the user. A handler that suppresses the user's own clicks has to let this one
 * through, or the deferred navigation never happens.
 */
export function isFollowingLink(element: HTMLElement): boolean {
  return element.dataset.following !== undefined;
}
