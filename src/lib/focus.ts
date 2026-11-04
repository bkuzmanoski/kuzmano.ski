/**
 * Focuses an element, temporarily assigning `tabindex="-1"` when it does not already have a `tabindex` attribute.
 *
 * On Chrome for Android, every focusable element becomes a TalkBack stop. Removing the temporary `tabindex` on blur
 * ensures that unnamed elements remain focusable only while they retain programmatic focus.
 */
export function focusWithTabIndexUntilBlur(element: HTMLElement, options?: FocusOptions): void {
  if (element.hasAttribute("tabindex")) {
    element.focus(options);
    return;
  }

  element.tabIndex = -1;
  element.focus(options);

  if (document.activeElement === element) {
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
  } else {
    element.removeAttribute("tabindex"); // The element did not take the focus (e.g., inside inert content or outside the document), so it has no `blur` to wait for.
  }
}
