import { createContext, use, useEffect, useEffectEvent } from "react";

import type { CloseGuard } from "./close-guards.ts";

export interface WindowClose {
  registerGuard: (guard: CloseGuard) => () => void;
  close: () => void;
  forceClose: () => void; // Completes a guarded close without running the guard again.
}

export const WindowCloseContext = createContext<WindowClose | null>(null);

export function useCloseWindow(): (() => void) | null {
  return use(WindowCloseContext)?.close ?? null;
}

/**
 * Registers `guard` for as long as the calling component is mounted. Returns a function
 * that completes the close without running the guard again.
 */
export function useCloseGuard(guard: CloseGuard): () => void {
  const windowClose = use(WindowCloseContext);
  const claimClose = useEffectEvent(guard);

  useEffect(() => windowClose?.registerGuard(() => claimClose()), [windowClose]);

  return () => windowClose?.forceClose();
}
