import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import { watchFaviconColorScheme } from "#/lib/favicon";
import bootSequenceOverlayScript from "#/scripts/boot-sequence-overlay.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

import type { ReactNode } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  useEffect(watchFaviconColorScheme, []);

  return (
    // suppressHydrationWarning: `themeScript` and `bootSequenceOverlayScript` set attributes on
    // `<html>` before hydration, so the client `<html>` differs from the one the server sent.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The `theme-color` pairs are declared here because `HeadContent` de-duplicates meta tags
            by `name`. The boot sequence colors override the normal theme colors and are removed by
            `boot-sequence-overlay.ts` when the boot sequence is skipped or completes. */}
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#353535"
        />
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#292929"
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#e6e6e6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#191919" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootSequenceOverlayScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
