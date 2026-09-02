import { documentTitle } from "#/metadata.ts";

const TITLE_SUFFIX = documentTitle(""); // The suffix on every page title. It comes from `documentTitle` so the two agree.
const MENU_BAR = 'aria-label="Main menu"'; // The label the menu bar renders in `/src/components/menu-bar.tsx`
const WINDOW_BODY = /id="window-content"[^>]*>(?:<!--.*?-->)*<(?!\/)/; // Content inside `FOCUSED_WINDOW_CONTENT_ID`, past the comments React writes around a Suspense boundary.
const LOADING_INDICATOR = "data-loading-indicator"; // The marker on `/src/components/spinner.tsx`.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };

// A title is compared across a text node and an attribute. The two use different escapes.
const decode = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (match, name: string) => ENTITIES[name] ?? match);

function documentTitleOf(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/.exec(html);
  return match?.[1] ? decode(match[1]) : null;
}

// Every window is a `<section>` with its title as the label.
function windowTitlesOf(html: string): Array<string> {
  return [...html.matchAll(/<section[^>]*aria-label="([^"]*)"/g)].map(([, title]) => decode(title!));
}

/** Checks prerendered HTML for the presence of required elements and fails the build if any are missing. */
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

    if (!pageTitle) {
      problems.push(title === null ? "the document title is missing" : `the document title is "${title}"`);
    } else if (!windowTitles.includes(pageTitle)) {
      problems.push(`there is no window titled "${pageTitle}"`);
    }

    if (!WINDOW_BODY.test(html)) {
      problems.push("the window body is empty");
    }

    if (html.includes(LOADING_INDICATOR)) {
      problems.push("the window body contains a loading indicator");
    }
  }

  if (problems.length > 0) {
    throw new Error(`Prerendered "${page.path}" is incomplete: ${problems.join(", ")}. `);
  }
}
