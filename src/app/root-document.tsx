import { HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { THEME_COLORS } from "virtual:theme-colors";

import chromeFontUrl from "#/assets/fonts/ChicagoFLF-Adjusted.woff2?url";
import { DOCUMENT_LANGUAGE } from "#/config/site.ts";
import { watchFaviconColorScheme } from "#/lib/favicon.ts";
import { preloadFont } from "#/lib/fonts.ts";
import { watchDesktopBackgroundThemeColors } from "#/lib/settings/desktop-background-theme-colors.ts";
import { watchStoredSettings } from "#/lib/settings/settings.ts";
import {
  COLOR_SCHEMES,
  DESKTOP_BACKGROUND_THEME_COLOR_ATTRIBUTE,
  THEME_COLOR_SCHEME_ATTRIBUTE,
  themeColorMediaFor,
} from "#/lib/settings/theme.ts";
import type { ColorScheme } from "#/lib/settings/theme.ts";
import { STARTUP_SEQUENCE_THEME_COLOR_ATTRIBUTE } from "#/lib/startup-sequence/overlay.ts";
import appearanceScript from "#/scripts/appearance.ts?inline-script";
import devicePixelRatioScript from "#/scripts/device-pixel-ratio.ts?inline-script";
import startupSequenceScript from "#/scripts/startup-sequence.ts?inline-script";
import themeTintScript from "#/scripts/theme-tint.ts?inline-script";
import webShareScript from "#/scripts/web-share.ts?inline-script";

import type { ReactNode } from "react";

function ThemeColorPair({ colors, markAttribute }: { colors: Record<ColorScheme, string>; markAttribute: string }) {
  return COLOR_SCHEMES.map((colorScheme) => (
    <meta
      key={colorScheme}
      name="theme-color"
      media={themeColorMediaFor(colorScheme, "system")}
      content={colors[colorScheme]}
      {...{ [markAttribute]: "", [THEME_COLOR_SCHEME_ATTRIBUTE]: colorScheme }}
      suppressHydrationWarning // `appearanceScript` applies a stored color scheme and `themeTintScript` applies stored tint colors.
    />
  ));
}

export function RootDocument({ children }: { children: ReactNode }) {
  useEffect(watchFaviconColorScheme, []);
  useEffect(watchStoredSettings, []);
  useEffect(watchDesktopBackgroundThemeColors, []);
  preloadFont(chromeFontUrl); // Every document renders the chrome face.

  return (
    // `suppressHydrationWarning` is needed because `appearanceScript`, `themeTintScript`, `startupSequenceScript`,
    // `webShareScript`, and `devicePixelRatioScript` set attributes on `<html>` before hydration.
    <html lang={DOCUMENT_LANGUAGE} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The `theme-color` pairs are declared here because `HeadContent` de-duplicates meta tags
            by `name`. The startup sequence colors override the normal theme colors and are removed by
            `/src/scripts/startup-sequence.ts` when the startup sequence is skipped or completes. */}
        <ThemeColorPair
          colors={THEME_COLORS.startupSequenceBackdrop}
          markAttribute={STARTUP_SEQUENCE_THEME_COLOR_ATTRIBUTE}
        />
        <ThemeColorPair
          colors={THEME_COLORS.desktopBackground}
          markAttribute={DESKTOP_BACKGROUND_THEME_COLOR_ATTRIBUTE}
        />
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeTintScript }} />
        <script dangerouslySetInnerHTML={{ __html: startupSequenceScript }} />
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
