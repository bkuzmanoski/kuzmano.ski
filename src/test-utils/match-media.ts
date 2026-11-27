import { vi } from "vitest";

type ChangeListener = (event: MediaQueryListEvent) => void;

/**
 * Stubs `matchMedia` with a shared media query list initialized to `matches: false`. Returns a setter that updates
 * `matches` and notifies `change` listeners (removing `once` listeners before calling them).
 */
export function stubMatchMedia() {
  const listeners = new Map<ChangeListener, { once: boolean }>();
  const media = {
    matches: false,
    addEventListener: (_type: string, listener: ChangeListener, options?: AddEventListenerOptions) =>
      listeners.set(listener, { once: options?.once ?? false }),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  };

  vi.stubGlobal("matchMedia", () => media);

  return (matches: boolean) => {
    media.matches = matches;

    for (const [listener, { once }] of [...listeners]) {
      if (once) {
        listeners.delete(listener);
      }

      listener({ matches } as MediaQueryListEvent);
    }
  };
}
