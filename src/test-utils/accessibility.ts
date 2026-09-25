/**
 * Returns the text of each element that `element`'s `aria-describedby` attribute names, in order and
 * separated by spaces, without the text of descendants that have the `aria-hidden` attribute.
 * Returns `null` when `element` does not have the attribute.
 */
export function descriptionTextOf(element: Element): string | null {
  const descriptionIds = element.getAttribute("aria-describedby");

  if (descriptionIds === null) {
    return null;
  }

  return descriptionIds
    .split(" ")
    .map((descriptionId) => {
      const description = document.getElementById(descriptionId)!.cloneNode(true) as Element;

      description.querySelectorAll("[aria-hidden]").forEach((hidden) => hidden.remove());

      return description.textContent;
    })
    .join(" ");
}
