import { WindowManagerProvider } from "#/lib/window-manager";
import { BootOverlay } from "#/ui/boot-overlay";
import { MenuBar } from "#/ui/menu-bar";

import styles from "./desktop.module.css";

import type { ReactNode } from "react";

/**
 * Mounted by the root route above the router outlet so it does not remount on navigation.
 * `children` is the outlet, which renders the route's window into the window layer.
 */
export function Desktop({ children }: { children: ReactNode }) {
  return (
    <WindowManagerProvider>
      <div className={styles.desktop}>
        <MenuBar />
        <div className={styles.windowLayer}>{children}</div>
      </div>
      <BootOverlay />
    </WindowManagerProvider>
  );
}
