import { WindowManagerProvider } from "#/lib/window-manager";
import { BootOverlay } from "#/ui/boot-overlay";
import { MenuBar } from "#/ui/menu-bar";

import styles from "./desktop.module.css";
import { WindowLayer } from "./window-layer";

import type { ReactNode } from "react";

/**
 * The desktop environment, mounted once by the root route above the outlet so it
 * never remounts on navigation. The window layer renders every open window;
 * `children` is the router outlet, which renders nothing visible (routes are
 * loader/head only) but keeps the matched route mounted for SSR and head tags.
 */
export function Desktop({ children }: { children: ReactNode }) {
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
