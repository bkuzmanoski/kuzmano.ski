import { createRootRoute } from "@tanstack/react-router";

import chromeFont from "#/assets/fonts/ChicagoFLF.woff2?url";
import stylesheet from "#/styles.css?url";
import { Desktop } from "#/views/desktop";
import { ErrorPage } from "#/views/error-page";
import { NotFound } from "#/views/not-found";
import { RootDocument } from "#/views/root-document";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
    ],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "preload", as: "font", href: chromeFont, type: "font/woff2", crossOrigin: "anonymous" }, // Fetch font with with the stylesheet as chrome font uses `font-display: block`.
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootDocument,
  component: Desktop,
  errorComponent: ErrorPage,
  notFoundComponent: NotFound,
});
