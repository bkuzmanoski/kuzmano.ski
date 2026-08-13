import { HeadContent, Scripts } from "@tanstack/react-router";

import bootOverlayScript from "#/scripts/boot-overlay.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

import type { ReactNode } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  return (
    /* suppressHydrationWarning: `themeScript` and `bootOverlayScript` set attributes on `<html>`
     * before hydration, so the client `<html>` differs from the one the server sent. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The `theme-color` pair is declared here because `HeadContent` de-duplicates meta by `name`. Values match colors defined in `styles.css`. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f4fd" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#17181e" />
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
