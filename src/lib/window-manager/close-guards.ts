import type { WindowId } from "./window.ts";

/**
 * Guards a window close request.
 *
 * Returning `true` claims the request and keeps the window open. The guard must
 * then complete the close using the function returned by `useCloseGuard`.
 */
export type CloseGuard = () => boolean;

/**
 * Registry of close guards for a window.
 *
 * Uses mutable state because `close` reads the current guard when a
 * request is made; the registry itself does not affect rendering.
 */
export interface CloseGuards {
  register: (id: WindowId, guard: CloseGuard) => () => void;
  claim: (id: WindowId) => boolean; // Invokes the window's guard and returns whether it claimed the close request.
}

export function createCloseGuards(): CloseGuards {
  const guards = new Map<WindowId, CloseGuard>();
  return {
    register(id, guard) {
      guards.set(id, guard);
      return () => {
        if (guards.get(id) === guard) {
          guards.delete(id);
        }
      };
    },
    claim: (id) => guards.get(id)?.() === true,
  };
}
