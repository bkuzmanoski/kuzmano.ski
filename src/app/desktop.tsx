import { Outlet } from "@tanstack/react-router";

import { WINDOW_LAYOUT } from "#/config/desktop.ts";
import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import { BootSequence } from "#/features/boot-sequence/boot-sequence.tsx";
import { MenuBar } from "#/features/menu-bar/menu-bar.tsx";
import { Screensaver } from "#/features/screensaver/screensaver.tsx";
import { NotFoundAlert } from "#/features/windows/not-found-alert.tsx";
import { WindowLayer } from "#/features/windows/window-layer.tsx";
import { WindowManagerProvider } from "#/features/windows/window-manager-provider.tsx";
import { useAudioUnlock } from "#/lib/audio/context.ts";
import { useKeyboardInset } from "#/lib/hooks/use-keyboard-inset.ts";

import styles from "./desktop.module.css";
import { SiteIndex } from "./site-index.tsx";
import { SkipLink } from "./skip-link.tsx";

/** The desktop environment, mounted once by the root route above the outlet so it does not remount on navigation. */
export function Desktop() {
  useAudioUnlock(); // The first gesture anywhere on the page readies the audio context (see `/src/lib/audio/context.ts`).
  useKeyboardInset(); // Keeps the desktop within the space left by the software keyboard (see `/src/lib/hooks/use-keyboard-inset.ts`).

  return (
    <WindowManagerProvider layout={WINDOW_LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
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
