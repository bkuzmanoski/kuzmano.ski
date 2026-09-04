import { scrollIntoViewSilently } from "../audio/scroll.ts";

/**
 * Scrolls the element a URL fragment identifies into view, aligned to the top of the scroll port,
 * and focuses it without scrolling again.
 *
 * The element is looked up by id within `article`. Returns `false` when the fragment is empty or
 * the article holds no element with that id, in which case nothing is scrolled or focused.
 */
export function revealFragmentTarget(article: Element, fragment: string): boolean {
  const id = fragment.startsWith("#") ? fragment.slice(1) : fragment;

  if (!id) {
    return false;
  }

  // The id is matched as an attribute so the lookup stays inside the article, which puts it
  // in a quoted CSS string: a backslash or a quote in the id has to be escaped to stay literal.
  const target = article.querySelector<HTMLElement>(`[id="${id.replace(/["\\]/g, "\\$&")}"]`);

  if (!target) {
    return false;
  }

  target.focus({ preventScroll: true });
  scrollIntoViewSilently(target, { block: "start" });

  return true;
}
