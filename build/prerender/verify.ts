import { fromHtml } from "hast-util-from-html";
import { select, selectAll } from "hast-util-select";
import { toString } from "hast-util-to-string";
import { CONTINUE, EXIT, visit } from "unist-util-visit";

import { documentTitle } from "#/site/metadata.ts";

import type { Nodes } from "hast";

const DOCUMENT_TITLE_SUFFIX = documentTitle("");
const MENU_BAR_SELECTOR = '[aria-label="Main menu"]';
const WINDOW_CONTENT_SELECTOR = "#window-content";
const LOADING_INDICATOR_SELECTOR = "[data-loading-indicator]";

// React's server renderer marks a Suspense boundary whose children threw with a `<!--$!-->` comment and
// streams the boundary's fallback in their place, in a response with a `200` status code. The browser then
// renders the children again, so the prerendered markup is the fallback rather than the content.
const ERRORED_SUSPENSE_BOUNDARY_COMMENT = "$!";

// TanStack Start waits for every Suspense boundary to resolve only for a bot's request, and the prerender
// request is not one. A boundary still suspended when the shell is sent is marked with a `<!--$?-->` comment
// around its fallback, and React streams its content, or its error, later with a script that replaces the
// fallback in the browser. The prerendered markup keeps the comment and the fallback in either case.
const PENDING_SUSPENSE_BOUNDARY_COMMENT = "$?";

function documentTitleOf(tree: Nodes): string | null {
  const titleElement = select("title", tree);
  return titleElement ? toString(titleElement) || null : null;
}

// Every window is a `<section>` named by its title in an `aria-label` attribute. Its title bar renders the
// same `title` prop as text, so only the attribute is checked.
function windowTitlesOf(tree: Nodes): Array<string> {
  return selectAll("section[aria-label]", tree).map((section) => String(section.properties.ariaLabel));
}

function hasSuspenseBoundaryMarkedWith(tree: Nodes, boundaryComment: string): boolean {
  let hasMarkedBoundary = false;

  visit(tree, "comment", (comment) => {
    hasMarkedBoundary = comment.value === boundaryComment;
    return hasMarkedBoundary ? EXIT : CONTINUE;
  });

  return hasMarkedBoundary;
}

/** Checks prerendered HTML for the presence of required elements and fails the build if any are missing. */
export function verifyPrerenderedDocument({ page, html }: { page: { path: string }; html: string }) {
  const problems: Array<string> = [];
  const pathSegments = page.path.split("/").filter(Boolean);
  const documentTree = fromHtml(html);

  if (hasSuspenseBoundaryMarkedWith(documentTree, ERRORED_SUSPENSE_BOUNDARY_COMMENT)) {
    problems.push("a component threw during the server render, and a Suspense boundary rendered its fallback");
  }

  if (hasSuspenseBoundaryMarkedWith(documentTree, PENDING_SUSPENSE_BOUNDARY_COMMENT)) {
    problems.push("a Suspense boundary was still suspended when the shell was sent, and rendered its fallback");
  }

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
