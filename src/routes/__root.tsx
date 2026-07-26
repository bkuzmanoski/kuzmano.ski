import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { bootOverlayScript } from "#/ui/boot-overlay";
import { Desktop } from "#/views/desktop";
import { Error } from "#/views/error";
import { NotFound } from "#/views/not-found";

import appCss from "../styles.css?url";

const Devtools =
  import.meta.env.DEV && import.meta.env.MODE !== "test"
    ? lazy(async () => {
        const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
          import("@tanstack/react-devtools"),
          import("@tanstack/react-router-devtools"),
        ]);

        return {
          default: () => (
            <TanStackDevtools
              config={{ position: "bottom-right" }}
              plugins={[{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> }]}
            />
          ),
        };
      })
    : null;

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  errorComponent: Error,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // bootOverlayScript sets data-boot on <html> before hydration,
    // which makes the client <html> different from the server <html>.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* This script runs before the first paint to prevent a flash of the desktop. See boot-overlay. */}
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
