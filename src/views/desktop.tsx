import { Outlet } from "@tanstack/react-router";

import { SkipLink } from "#/components/skip-link";
import { INITIAL_WINDOW_ROUTE } from "#/config/navigation";
import { LAYOUT } from "#/config/windows";
import { useAudioUnlock } from "#/lib/audio/context";

import { BootSequence } from "./boot-sequence";
import styles from "./desktop.module.css";
import { MenuBar } from "./menu-bar";
import { WindowLayer } from "./window-layer";
import { WindowManagerProvider } from "./window-manager-provider";

import type { ReactNode } from "react";

/**
 * The desktop environment, mounted once by the root route above the outlet so it
 * does not remount on navigation.
 */
export function Desktop({ children }: { children: ReactNode }) {
  // The first gesture anywhere on the page readies the audio context (see lib/audio/context).
  useAudioUnlock();

  return (
    <WindowManagerProvider layout={LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
      <div className={styles.desktop}>
        <SkipLink />
        <MenuBar />
        <WindowLayer>{children}</WindowLayer>
      </div>
      <BootSequence />
    </WindowManagerProvider>
  );
}

/** The root route's component: the desktop wrapped around the outlet every route renders into. */
export function DesktopRoot() {
  return (
    <Desktop>
      <Outlet />
    </Desktop>
  );
}
