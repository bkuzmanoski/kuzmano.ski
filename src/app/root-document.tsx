import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { THEME_COLORS } from "virtual:theme-colors";

import chromeFontUrl from "#/assets/fonts/ChicagoFLF-Adjusted.woff2?url";
import { DOCUMENT_LANGUAGE } from "#/config/site.ts";
import { watchFaviconColorScheme } from "#/lib/favicon.ts";
import { preloadFont } from "#/lib/fonts.ts";
import bootSequenceScript from "#/scripts/boot-sequence.ts?inline-script";
import devicePixelRatioScript from "#/scripts/device-pixel-ratio.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";
import webShareScript from "#/scripts/web-share.ts?inline-script";

import type { ReactNode } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  useEffect(watchFaviconColorScheme, []);
  preloadFont(chromeFontUrl); // Every document renders the chrome face.

  return (
    // suppressHydrationWarning: `themeScript`, `bootSequenceScript`, `webShareScript`, and `devicePixelRatioScript`
    // set attributes on `<html>` before hydration, so the client `<html>` differs from the one the server sent.
    <html lang={DOCUMENT_LANGUAGE} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The `theme-color` pairs are declared here because `HeadContent` de-duplicates meta tags
            by `name`. The boot sequence colors override the normal theme colors and are removed by
            `/src/scripts/boot-sequence.ts` when the boot sequence is skipped or completes. */}
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={THEME_COLORS.bootSequenceBackdrop.light}
        />
        <meta
          data-boot-sequence-theme-color
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={THEME_COLORS.bootSequenceBackdrop.dark}
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.wallpaper.light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.wallpaper.dark} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootSequenceScript }} />
        <script dangerouslySetInnerHTML={{ __html: webShareScript }} />
        <script dangerouslySetInnerHTML={{ __html: devicePixelRatioScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
