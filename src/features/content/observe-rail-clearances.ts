import { railClearanceOf } from "#/lib/content/rail-clearance.ts";

const RAIL_CLEARANCE_PROPERTY = "--content-body-rail-clearance";
const END_RAIL_CLEARANCE_PROPERTY = "--content-body-end-rail-clearance";
const LABELED_ELEMENT_SELECTOR = "h2, figure, table, blockquote";
const MASTHEAD_SELECTOR = "[data-entry-masthead]";
const MASTHEAD_SUBJECT_SELECTOR =
  '[data-entry-masthead] + h1 + :is(p, h2):not([data-content-span="wide"], [data-content-span="pane"])'; // Matches the element `content-body.module.css` anchors the masthead to, including that rule's `:not()`.
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
      // The masthead moves with its subject, so it counts only toward the elements after the subject
      // (clearing the subject of the masthead would move both down on every update).
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
  if (!body || typeof CSS === "undefined" || !CSS.supports("anchor-scope: all")) {
    return;
  }

  let frame = 0;
  let isObserving = true;

  // Measured before the ref callback returns, as well as on resize, so that the article's ref callback,
  // which React calls after this one, scrolls to a fragment target where the clearances place it.
  updateRailClearances(body);

  // Deferred to the next frame, so the resize the update causes is observed in that frame rather than
  // while the observer is still delivering this one.
  const scheduleUpdate = () => {
    if (isObserving) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => updateRailClearances(body));
    }
  };
  const observer = new ResizeObserver(scheduleUpdate);

  observer.observe(body);
  void document.fonts.ready.then(scheduleUpdate);

  return () => {
    isObserving = false;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
