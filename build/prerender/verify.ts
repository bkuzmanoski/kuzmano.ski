import { fromHtml } from "hast-util-from-html";
import { select, selectAll } from "hast-util-select";
import { toString } from "hast-util-to-string";

import { documentTitle } from "#/site/metadata.ts";

import type { Element, Nodes } from "hast";

const DOCUMENT_TITLE_SUFFIX = documentTitle("");
const MENU_BAR_SELECTOR = '[aria-label="Main menu"]';
const WINDOW_CONTENT_SELECTOR = "#window-content";
const LOADING_INDICATOR_SELECTOR = "[data-loading-indicator]";

function documentTitleOf(tree: Nodes): string | null {
  const titleElement = select("title", tree);
  return titleElement ? toString(titleElement) || null : null;
}

function labelIdOf(section: Element): string {
  const labelledBy = section.properties.ariaLabelledBy;
  return String((Array.isArray(labelledBy) ? labelledBy[0] : labelledBy) ?? "");
}

// Every window is a `<section>` labelled by the element that holds its title. The ids come
// from `useId`, so they are resolved by lookup rather than by matching a known value.
function windowTitlesOf(tree: Nodes): Array<string> {
  const textById = new Map(
    selectAll("[id]", tree).map((element) => [String(element.properties.id), toString(element)]),
  );
  return selectAll("section[aria-labelledby]", tree).flatMap((section) => textById.get(labelIdOf(section)) ?? []);
}

/** Checks prerendered HTML for the presence of required elements and fails the build if any are missing. */
export function verifyPrerenderedDocument({ page, html }: { page: { path: string }; html: string }) {
  const problems: Array<string> = [];
  const pathSegments = page.path.split("/").filter(Boolean);
  const documentTree = fromHtml(html);

  if (!select(MENU_BAR_SELECTOR, documentTree)) {
    problems.push("the menu bar is missing");
  }

  if (pathSegments.length > 0) {
    const title = documentTitleOf(documentTree);
    const pageTitle = title?.endsWith(DOCUMENT_TITLE_SUFFIX) ? title.slice(0, -DOCUMENT_TITLE_SUFFIX.length) : null;
    const windowTitles = windowTitlesOf(documentTree);

    if (!pageTitle) {
      problems.push(title === null ? "the document title is missing" : `the document title is "${title}"`);
    } else if (!windowTitles.includes(pageTitle)) {
      problems.push(`there is no window titled "${pageTitle}"`);
    }

    const windowBody = select(WINDOW_CONTENT_SELECTOR, documentTree);

    if (!windowBody?.children.some((child) => child.type === "element")) {
      problems.push("the window body is empty");
    }

    if (windowBody && select(LOADING_INDICATOR_SELECTOR, windowBody)) {
      problems.push("the window body contains a loading indicator");
    }
  }

  if (problems.length > 0) {
    throw new Error(`Prerendered "${page.path}" is incomplete: ${problems.join(", ")}. `);
  }
}
