import { BootSequence } from "#/components/boot-sequence";
import { MenuBar } from "#/components/menu-bar";
import { SkipLink } from "#/components/skip-link";
import { INITIAL_WINDOW_ROUTE } from "#/config/navigation";
import { WINDOW_LAYOUT } from "#/config/windows";
import { useAudioUnlock } from "#/lib/audio/context";
import { WindowManagerProvider } from "#/lib/window-manager";

import styles from "./desktop.module.css";
import { WindowLayer } from "./window-layer";

import type { ReactNode } from "react";

/**
 * The desktop environment, mounted once by the root route above the outlet so it
 * does not remount on navigation.
 */
export function Desktop({ children }: { children: ReactNode }) {
  // The first gesture anywhere on the page readies the audio context (see lib/audio/context).
  useAudioUnlock();

  return (
    <WindowManagerProvider layout={WINDOW_LAYOUT} initialRoute={INITIAL_WINDOW_ROUTE}>
      <div className={styles.desktop}>
        <SkipLink />
        <MenuBar />
        <WindowLayer>{children}</WindowLayer>
      </div>
      <BootSequence />
    </WindowManagerProvider>
  );
}
