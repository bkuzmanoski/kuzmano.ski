import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import chromeFont from "#/assets/fonts/ChicagoFLF.woff2?url";
import consoleFont from "#/assets/fonts/Monaco9.woff2?url";
import { themeScript } from "#/lib/settings";
import stylesheet from "#/styles.css?url";
import { bootOverlayScript } from "#/ui/boot-sequence";
import { Desktop } from "#/views/desktop";
import { ErrorView } from "#/views/error-view";
import { NotFound } from "#/views/not-found";

import type { ReactNode } from "react";

const Devtools =
  import.meta.env.DEV && import.meta.env.MODE !== "test"
    ? lazy(async () => {
        const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
          import("@tanstack/react-devtools"),
          import("@tanstack/react-router-devtools"),
        ]);

        return {
          default: () => (
            <TanStackDevtools plugins={[{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> }]} />
          ),
        };
      })
    : null;

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "preload", as: "font", type: "font/woff2", href: chromeFont, crossOrigin: "anonymous" }, // Fetch font with with the stylesheet as chrome font uses `font-display: block`.
      { rel: "preload", as: "font", type: "font/woff2", href: consoleFont, crossOrigin: "anonymous" }, // Fetch font with with the stylesheet as console font uses `font-display: block`.
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: ErrorView,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    /* `themeScript` and `bootOverlayScript` set attributes on `<html>` before
     * hydration, so the client <html> differs from the server's. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootOverlayScript }} />
      </head>
      <body>
        <Desktop>{children}</Desktop>
        {Devtools && (
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  );
}
