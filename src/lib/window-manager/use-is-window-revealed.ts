import { createContext, use } from "react";

/** `false` while the surrounding window is hidden or has not appeared after startup. */
export const WindowRevealContext = createContext(true);

/** Returns `true` when no window is present, allowing dependent content to render normally. */
export function useIsWindowRevealed(): boolean {
  return use(WindowRevealContext);
}
