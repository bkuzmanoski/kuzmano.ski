import { vi } from "vitest";

type ChangeListener = (event: MediaQueryListEvent) => void;

/**
 * Stubs `matchMedia` with one media query list whose `matches` is `false`, for every query. Returns
 * a function that sets `matches` and calls each `change` listener with an event that has the same
 * `matches`. A listener added with `once` is removed before it is called, as a real media query list
 * removes it.
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
