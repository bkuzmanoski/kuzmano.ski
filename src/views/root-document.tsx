import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import { getSettings } from "#/lib/settings";
import { THEME_COLORS, applyTheme } from "#/lib/theme";
import bootOverlayScript from "#/scripts/boot-overlay.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

import type { ReactNode } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  /* Head hydration can restore the server-rendered `theme-color` metas over the
   * values the pre-hydration script set, so re-assert the stored theme once mounted. */
  useEffect(() => {
    applyTheme(getSettings().theme);
  }, []);

  return (
    /* `themeScript` and `bootOverlayScript` set attributes on `<html>` before
     * hydration, so the client `<html>` differs from the one the server sent. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Rendered here instead of the route head config, which dedupes
         * metas by name  and would keep only one of the scheme pair. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
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
