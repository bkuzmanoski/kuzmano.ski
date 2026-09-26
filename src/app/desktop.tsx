import { Outlet } from "@tanstack/react-router";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import { BootSequence } from "#/features/boot-sequence/boot-sequence.tsx";
import { MenuBar } from "#/features/menu-bar/menu-bar.tsx";
import { Screensaver } from "#/features/screensaver/screensaver.tsx";
import { NotFoundAlert } from "#/features/window-manager/not-found-alert.tsx";
import { WindowLayer } from "#/features/window-manager/window-layer.tsx";
import { WindowManagerProvider } from "#/features/window-manager/window-manager-provider.tsx";
import { useAudioUnlock } from "#/lib/audio/context.ts";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/lifecycle.ts";
import { useMotionDurations } from "#/lib/boot-sequence/use-motion-durations.ts";
import { useKeyboardInset } from "#/lib/hooks/use-keyboard-inset.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import { EntryCoverImagesProvider } from "#/site/entry-cover-images.tsx";
import { WINDOW_LAYOUT } from "#/site/window-layout.ts";

import styles from "./desktop.module.css";
import { SiteIndex } from "./site-index.tsx";
import { SkipLink } from "./skip-link.tsx";

/** The desktop environment, mounted once by the root route above the outlet so it does not remount on navigation. */
export function Desktop() {
  useAudioUnlock(); // The first gesture anywhere on the page readies the audio context (see `/src/lib/audio/context.ts`).
  useKeyboardInset(); // Keeps the desktop within the space left by the software keyboard (see `/src/lib/hooks/use-keyboard-inset.ts`).

  const isBootSequenceComplete = useIsBootSequenceComplete();
  const desktopStyle: StyleWithVars = {
    "--duration-desktop-reveal-step": `${useMotionDurations().desktopReveal}ms`,
  };

  return (
    <WindowManagerProvider layout={WINDOW_LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
      <EntryCoverImagesProvider>
        {/* Inert while the boot sequence covers it, so neither the focus nor a screen reader
            reaches the desktop before it is revealed. */}
        <div className={styles.desktop} style={desktopStyle} inert={!isBootSequenceComplete}>
          <SkipLink />
          <SiteIndex />
          <MenuBar />
          <WindowLayer>
            <Outlet />
          </WindowLayer>
          <NotFoundAlert />
        </div>
        <BootSequence />
        <Screensaver />
      </EntryCoverImagesProvider>
    </WindowManagerProvider>
  );
}
