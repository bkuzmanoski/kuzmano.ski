import { createFrameScheduler } from "#/lib/animation-frames.ts";

const RAIL_CLEARANCE_PROPERTY = "--content-body-rail-clearance";
const END_RAIL_CLEARANCE_PROPERTY = "--content-body-end-rail-clearance";
const LABELED_ELEMENT_SELECTOR = "h2, figure, table, blockquote";
const MASTHEAD_SELECTOR = "[data-entry-masthead]";

/** Matches the element `content-body.module.css` anchors the masthead to, with its `:--within-rail-span` expanded. */
const MASTHEAD_SUBJECT_SELECTOR =
  '[data-entry-masthead] + h1 + :is(p, h2):not([data-content-span="wide"], [data-content-span="pane"])';

const RAIL_SPANNING_ELEMENT_SELECTOR = 'h2, [data-content-span]:not([data-content-span="text"])';

const paddingBoxTopOf = (element: Element) =>
  element.getBoundingClientRect().top + parseFloat(getComputedStyle(element).borderTopWidth);

function railItemBottomsIn(element: Element, body: Element): Array<number> {
  if (element.hasAttribute("data-rail-asides")) {
    return [...element.children].map((aside) => aside.getBoundingClientRect().bottom);
  }

  if (element.matches(MASTHEAD_SELECTOR)) {
    return getComputedStyle(element).position === "absolute" ? [element.getBoundingClientRect().bottom] : [];
  }

  if (!element.matches(LABELED_ELEMENT_SELECTOR)) {
    return [];
  }

  const beforeStyle = getComputedStyle(element, "::before");

  if (beforeStyle.position !== "absolute") {
    return [];
  }

  const containingBlock = getComputedStyle(element).position === "static" ? body : element;
  const bottom = paddingBoxTopOf(containingBlock) + parseFloat(beforeStyle.top) + parseFloat(beforeStyle.height);

  return Number.isFinite(bottom) ? [bottom] : [];
}

function setRailClearance(element: HTMLElement, property: string, clearance: number) {
  const clearanceValue = clearance > 0 ? `${clearance}px` : "";

  if (element.style.getPropertyValue(property) !== clearanceValue) {
    element.style.setProperty(property, clearanceValue);
  }
}

/**
 * The whole pixels to add to the space before an element so that the lowest of the rail items before it ends above
 * `rowTop`, the element's top less the space before it. Returns 0 when every rail item ends above it, or when
 * `railItemBottoms` is empty.
 */
export const railClearanceOf = (railItemBottoms: Array<number>, rowTop: number) =>
  Math.max(0, Math.ceil(Math.max(...railItemBottoms) - rowTop));

function updateRailClearances(body: HTMLElement) {
  const railItemBottoms: Array<number> = [];

  let mastheadBottoms: Array<number> = [];

  for (const element of body.children) {
    if (element instanceof HTMLElement && element.matches(RAIL_SPANNING_ELEMENT_SELECTOR)) {
      const spaceBefore = parseFloat(getComputedStyle(element).marginBlockStart);
      const clearance = railClearanceOf(railItemBottoms, element.getBoundingClientRect().top - spaceBefore);

      setRailClearance(element, RAIL_CLEARANCE_PROPERTY, clearance);
    }

    if (element.matches(MASTHEAD_SELECTOR)) {
      // The masthead moves with its subject, so it counts only toward the elements after the subject (clearing the
      // subject of the masthead would move both down on every update).
      mastheadBottoms = railItemBottomsIn(element, body);
      continue;
    }

    railItemBottoms.push(...railItemBottomsIn(element, body));

    if (element.matches(MASTHEAD_SUBJECT_SELECTOR)) {
      railItemBottoms.push(...mastheadBottoms);
    }
  }

  const bodyStyle = getComputedStyle(body);
  const contentBottom =
    body.getBoundingClientRect().bottom -
    parseFloat(bodyStyle.borderBlockEndWidth) -
    parseFloat(bodyStyle.paddingBlockEnd);

  setRailClearance(body, END_RAIL_CLEARANCE_PROPERTY, railClearanceOf(railItemBottoms, contentBottom));
}

/**
 * Ref callback for an entry body that keeps rail-spanning elements clear of preceding rail items.
 *
 * Returns a cleanup function that stops observing.
 */
export function observeRailClearances(body: HTMLElement | null) {
  if (!body || !CSS.supports("anchor-scope: all")) {
    return;
  }

  // Measured before the ref callback returns, as well as on resize, so that the article's ref callback, which React
  // calls after this one, scrolls to a fragment target where the clearances place it.
  //
  // Note: After a client-side navigation, this performs the new entry's first layout, which the frame would otherwise
  // perform, so Chrome reports a forced reflow that deferring the update would not remove.
  updateRailClearances(body);

  // Deferred to the next frame, so the resize the update causes is observed in that frame rather than while the
  // observer is still delivering this one.
  const update = createFrameScheduler(() => updateRailClearances(body));
  const observer = new ResizeObserver(update.schedule);

  observer.observe(body);
  void document.fonts.ready.then(update.schedule); // `update` ignores this once stopped as the promise can settle after cleanup.

  return () => {
    observer.disconnect();
    update.stop();
  };
}
