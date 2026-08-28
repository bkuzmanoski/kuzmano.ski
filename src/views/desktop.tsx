import { Outlet } from "@tanstack/react-router";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation";
import { LAYOUT } from "#/config/windows";
import { useAudioUnlock } from "#/lib/audio/context";
import { useKeyboardInset } from "#/lib/hooks/use-keyboard-inset";

import { BootSequence } from "./boot-sequence";
import styles from "./desktop.module.css";
import { MenuBar } from "./menu-bar";
import { NotFoundAlert } from "./not-found";
import { Screensaver } from "./screensaver";
import { SiteIndex } from "./site-index";
import { SkipLink } from "./skip-link";
import { WindowLayer } from "./window-layer";
import { WindowManagerProvider } from "./window-manager-provider";

/**
 * The desktop environment, mounted once by the root route above the
 * outlet so it does not remount on navigation.
 */
export function Desktop() {
  useAudioUnlock(); // The first gesture anywhere on the page readies the audio context (see `/src/lib/audio/context.ts`).
  useKeyboardInset(); // Keeps the desktop within the space left by the software keyboard (see `/src/lib/hooks/use-keyboard-inset.ts`).

  return (
    <WindowManagerProvider layout={LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
      <div className={styles.desktop}>
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
    </WindowManagerProvider>
  );
}
