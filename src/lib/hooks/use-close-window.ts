import { createContext, use, useEffect, useRef } from "react";

import type { CloseGuard } from "#/lib/window-manager/close-guards";

export interface WindowClose {
  registerGuard: (guard: CloseGuard) => () => void;
  close: () => void;
  forceClose: () => void; // Completes a guarded close without running the guard again.
}

export const WindowCloseContext = createContext<WindowClose | null>(null);

/** Closes the containing window, or `null` if there is no window around the current subtree. */
export function useCloseWindow(): (() => void) | null {
  return use(WindowCloseContext)?.close ?? null;
}

/**
 * Registers `guard` for as long as the calling component is mounted.
 * Returns a function that completes the close without running the guard again.
 */
export function useCloseGuard(guard: CloseGuard): () => void {
  const windowClose = use(WindowCloseContext);
  const guardRef = useRef(guard);

  useEffect(() => {
    guardRef.current = guard;
  });

  useEffect(() => windowClose?.registerGuard(() => guardRef.current()), [windowClose]);

  return () => windowClose?.forceClose();
}
