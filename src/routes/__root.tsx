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
    // bootOverlayScript sets data-boot on <html> before hydration, so the client <html> intentionally differs from the server's.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Runs before first paint to prevent a desktop flash before the boot; see boot-overlay. */}
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
