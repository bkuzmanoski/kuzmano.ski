import { createRootRoute } from "@tanstack/react-router";

import { Desktop } from "#/app/desktop.tsx";
import { ErrorPage } from "#/app/error-page.tsx";
import { NotFound } from "#/app/not-found.tsx";
import { RootDocument } from "#/app/root-document.tsx";
import chromeFont from "#/assets/fonts/ChicagoFLF.woff2?url";
import { FEED_TYPE } from "#/config/site.ts";
import { SITE_FEED } from "#/site/feeds.ts";
import stylesheet from "#/styles.css?url";

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
      { rel: "preload", as: "font", href: chromeFont, type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "alternate", type: FEED_TYPE, href: SITE_FEED.path, title: SITE_FEED.title },
    ],
  }),
  shellComponent: RootDocument,
  component: Desktop,
  errorComponent: ErrorPage,
  notFoundComponent: NotFound,
});
