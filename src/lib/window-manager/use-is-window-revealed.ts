import { createContext, use } from "react";

/** `false` while the window around the content is hidden or has not yet appeared after the startup sequence. */
export const WindowRevealContext = createContext(true);

/** Returns `true` outside a window, so content that waits for the window to appear also renders outside one. */
export function useIsWindowRevealed(): boolean {
  return use(WindowRevealContext);
}
