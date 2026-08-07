import { COLLECTION_TITLES } from "#/config/navigation";
import { documentTitle } from "#/config/site";

const TITLE_SUFFIX = documentTitle(""); // The suffix on every page title. It comes from `documentTitle` so the two agree.
const MENU_BAR = 'aria-label="Main menu"'; // The label the menu bar draws in `src/components/menu-bar.tsx`
const CONTENT_BODY = "<article"; // The element a content body opens with in `src/views/content-body.tsx`
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };

/* A title is compared across a text node and an attribute. The two use different escapes. */
const decode = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (match, name: string) => ENTITIES[name] ?? match);

function documentTitleOf(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/.exec(html);
  return match?.[1] ? decode(match[1]) : null;
}

/* Every window is a `<section>` with its title as the label. Nothing else on the page is one. */
function windowTitlesOf(html: string): Array<string> {
  return [...html.matchAll(/<section[^>]*aria-label="([^"]*)"/g)].map(([, title]) => decode(title!));
}

/**
 * Checks prerendered HTML for the presence of required elements.
 *
 * A component that throws during the server render does not fail the render. React
 * logs the error, streams the markup it has reached, and leaves the rest to the
 * client. The prerenderer receives a 200 and writes the partial page, so the fault
 * appears only in the browser. This check reads the written markup for the parts that
 * must be there, and makes the build fail if one is missing.
 *
 * Every page has the desktop chrome. Every page except the desktop also opens a window
 * with a body in it. The window carries the same title as the document, except on a
 * collection index: that opens on the most recent entry, which titles the window (see
 * `windowRouteFor` in `src/lib/window-registry.ts`).
 */
export function verifyPrerenderedPage({ page, html }: { page: { path: string }; html: string }) {
  const problems: Array<string> = [];
  const segments = page.path.split("/").filter(Boolean);

  if (!html.includes(MENU_BAR)) {
    problems.push("the menu bar is missing");
  }

  if (segments.length > 0) {
    const title = documentTitleOf(html);
    const pageTitle = title?.endsWith(TITLE_SUFFIX) ? title.slice(0, -TITLE_SUFFIX.length) : null;
    const windowTitles = windowTitlesOf(html);
    const isCollectionIndex = segments.length === 1 && segments[0]! in COLLECTION_TITLES;

    if (!pageTitle) {
      problems.push(title === null ? "the document title is missing" : `the document title is "${title}"`);
    } else if (isCollectionIndex ? windowTitles.length === 0 : !windowTitles.includes(pageTitle)) {
      problems.push(isCollectionIndex ? "no window is open" : `no window is titled "${pageTitle}"`);
    }

    if (!html.includes(CONTENT_BODY)) {
      problems.push("the content body is missing");
    }
  }

  if (problems.length > 0) {
    throw new Error(`Prerendered "${page.path}" is incomplete: ${problems.join(", ")}. `);
  }
}
