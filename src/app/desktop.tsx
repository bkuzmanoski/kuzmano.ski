import { Outlet } from "@tanstack/react-router";

import { WINDOW_LAYOUT } from "#/config/desktop.ts";
import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import { MenuBar } from "#/features/menu-bar/menu-bar.tsx";
import { Screensaver } from "#/features/screensaver/screensaver.tsx";
import { StartupSequence } from "#/features/startup-sequence/startup-sequence.tsx";
import { NotFoundAlert } from "#/features/window-manager/not-found-alert.tsx";
import { WindowLayer } from "#/features/window-manager/window-layer.tsx";
import { WindowManagerProvider } from "#/features/window-manager/window-manager-provider.tsx";
import { useAudioUnlock } from "#/lib/audio/context.ts";
import { usePreventViewportPanOnTextFieldFocus } from "#/lib/software-keyboard/use-prevent-viewport-pan-on-text-field-focus.ts";
import { useViewportHeightAboveSoftwareKeyboard } from "#/lib/software-keyboard/use-viewport-height-above-software-keyboard.ts";
import { useIsStartupSequenceComplete } from "#/lib/startup-sequence/lifecycle.ts";
import { useMotionDurations } from "#/lib/startup-sequence/use-motion-durations.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./desktop.module.css";
import { SiteIndex } from "./site-index.tsx";
import { SkipLink } from "./skip-link.tsx";

/** The desktop environment, mounted once by the root route above the outlet so it does not remount on navigation. */
export function Desktop() {
  useAudioUnlock(); // The first gesture anywhere on the page readies the audio context (see `/src/lib/audio/context.ts`).
  useViewportHeightAboveSoftwareKeyboard(); // Keeps the desktop within the space left by the software keyboard (see `/src/lib/software-keyboard/use-viewport-height-above-software-keyboard.ts`).
  usePreventViewportPanOnTextFieldFocus(); // Stops iOS from panning the page to reveal a focused field, which the resize above makes unnecessary (see `/src/lib/software-keyboard/use-prevent-viewport-pan-on-text-field-focus.ts`).

  const isStartupSequenceComplete = useIsStartupSequenceComplete();
  const desktopStyle: StyleWithVars = {
    "--duration-desktop-reveal-step": `${useMotionDurations().desktopReveal}ms`,
  };

  return (
    <WindowManagerProvider layout={WINDOW_LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
      {/* `inert` keeps the desktop inaccessible to focus and screen readers until the startup sequence finishes. */}
      <div className={styles.desktop} style={desktopStyle} inert={!isStartupSequenceComplete}>
        <SkipLink />
        <SiteIndex />
        <MenuBar />
        <WindowLayer>
          <Outlet />
        </WindowLayer>
        <NotFoundAlert />
      </div>
      <StartupSequence />
      <Screensaver />
    </WindowManagerProvider>
  );
}
