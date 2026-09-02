import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import { watchFaviconColorScheme } from "#/lib/favicon";
import bootSequenceScript from "#/scripts/boot-sequence.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

import type { ReactNode } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  useEffect(watchFaviconColorScheme, []);

  return (
    // suppressHydrationWarning: `themeScript` and `bootSequenceScript` set attributes on
    // `<html>` before hydration, so the client `<html>` differs from the one the server sent.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The `theme-color` pairs are declared here because `HeadContent` de-duplicates meta tags
            by `name`. The boot sequence colors override the normal theme colors and are removed by
            `/scripts/boot-sequence.ts` when the boot sequence is skipped or completes. */}
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#2e373c"
        />
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#232a2f"
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#e3e7ea" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#151a1d" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootSequenceScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
