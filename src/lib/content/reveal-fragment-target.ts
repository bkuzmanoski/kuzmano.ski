import { scrollIntoViewSilently } from "../audio/scroll.ts";

function decodedFragmentOf(fragment: string) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

export function revealFragmentTarget(article: Element, fragment: string): boolean {
  const id = decodedFragmentOf(fragment.startsWith("#") ? fragment.slice(1) : fragment); // Decode percent-encoded fragments so they match their IDs.

  if (!id) {
    return false;
  }

  const target = article.querySelector<HTMLElement>(`[id="${id.replace(/["\\]/g, "\\$&")}"]`); // Escape quotes and backslashes for the CSS attribute selector.

  if (!target) {
    return false;
  }

  target.focus({ preventScroll: true });
  scrollIntoViewSilently(target, {
    block: target.matches("[data-footnote], [data-footnote-reference]") ? "nearest" : "start",
  });

  return true;
}
