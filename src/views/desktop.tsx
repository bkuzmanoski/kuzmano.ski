import { WindowManagerProvider } from "#/lib/window-manager";
import { BootOverlay } from "#/ui/boot-overlay";
import { MenuBar } from "#/ui/menu-bar";

import styles from "./desktop.module.css";

import type { ReactNode } from "react";

/**
 * The root route mounts this component above the router outlet. The component
 * does not mount again after navigation.
 *
 * `children` is the outlet. The outlet renders the window of the route into
 * the window layer.
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
