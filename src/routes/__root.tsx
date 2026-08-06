import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";

import chromeFont from "#/assets/fonts/ChicagoFLF.woff2?url";
import bootOverlayScript from "#/scripts/boot-overlay.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";
import stylesheet from "#/styles.css?url";
import { Desktop } from "#/views/desktop";
import { ErrorView } from "#/views/error-view";
import { NotFoundPage } from "#/views/not-found";

import type { ReactNode } from "react";

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }],
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

function RootDocument({ children }: { children: ReactNode }) {
  return (
    /* `themeScript` and `bootOverlayScript` set attributes on `<html>` before
     * hydration, so the client `<html>` differs from the one the server sent. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootOverlayScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function DesktopRoot() {
  return (
    <Desktop>
      <Outlet />
    </Desktop>
  );
}
