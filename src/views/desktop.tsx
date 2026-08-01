import { useAudioUnlock } from "#/lib/sound";
import { WindowManagerProvider } from "#/lib/window-manager";
import { BootOverlay } from "#/ui/boot-overlay";
import { MenuBar } from "#/ui/menu-bar";

import styles from "./desktop.module.css";
import { WindowLayer } from "./window-layer";

import type { ReactNode } from "react";

/**
 * The desktop environment, mounted once by the root route above the outlet so it
 * does not remount on navigation.
 */
export function Desktop({ children }: { children: ReactNode }) {
  // The first gesture anywhere on the page readies the audio context (see lib/sound).
  useAudioUnlock();

  return (
    <WindowManagerProvider>
      <div className={styles.desktop}>
        <MenuBar />
        <WindowLayer>{children}</WindowLayer>
      </div>
      <BootOverlay />
    </WindowManagerProvider>
  );
}
