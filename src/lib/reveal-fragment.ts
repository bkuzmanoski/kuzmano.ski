import { scrollIntoViewSilently } from "#/lib/audio/scroll";

/**
 * Scrolls the element a URL fragment names into view and focuses it.
 *
 * Returns whether the fragment named an element within the article was found.
 */
export function revealFragment(article: Element, fragment: string): boolean {
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
