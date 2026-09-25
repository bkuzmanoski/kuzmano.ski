import { createContext, use, useEffect, useEffectEvent } from "react";

import type { KeyboardEvent } from "react";

/**
 * Handles a key pressed while a window itself, rather than an element in its content, has the
 * focus. The handler runs before the window scrolls its content for the key, and calling
 * `preventDefault` on the event claims the key, so the content does not also scroll.
 */
export type WindowKeyDownHandler = (event: KeyboardEvent) => void;

/**
 * Registry of the key handlers the content of one window registers.
 *
 * Uses mutable state because the window reads the registered handlers when a key is pressed; the
 * registry itself does not affect rendering.
 */
export interface WindowKeyDownHandlers {
  register: (handler: WindowKeyDownHandler) => () => void;
  handle: (event: KeyboardEvent) => void; // Runs the registered handlers in the order they were registered, until one claims the key.
}

export function createWindowKeyDownHandlers(): WindowKeyDownHandlers {
  const handlers = new Set<WindowKeyDownHandler>();
  return {
    register(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    handle(event) {
      for (const handler of handlers) {
        handler(event);

        if (event.defaultPrevented) {
          break;
        }
      }
    },
  };
}

export const WindowKeyDownContext = createContext<WindowKeyDownHandlers | null>(null);

/** Registers `handler` with the window that renders the caller, for as long as the caller is mounted. */
export function useWindowKeyDown(handler: WindowKeyDownHandler) {
  const windowKeyDownHandlers = use(WindowKeyDownContext);
  const onKeyDown = useEffectEvent(handler);

  useEffect(() => windowKeyDownHandlers?.register((event) => onKeyDown(event)), [windowKeyDownHandlers]);
}
