import { createRootRoute } from "@tanstack/react-router";

import chromeFont from "#/assets/fonts/ChicagoFLF.woff2?url";
import stylesheet from "#/styles.css?url";
import { DesktopRoot } from "#/views/desktop";
import { ErrorView } from "#/views/error-view";
import { NotFoundPage } from "#/views/not-found";
import { RootDocument } from "#/views/root-document";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "preload", as: "font", type: "font/woff2", href: chromeFont, crossOrigin: "anonymous" }, // Fetch font with with the stylesheet as chrome font uses `font-display: block`.
    ],
  }),
  shellComponent: RootDocument,
  component: DesktopRoot,
  errorComponent: ErrorView,
  notFoundComponent: NotFoundPage, // A not found route that reaches the root gets the standalone 404 page.
});
