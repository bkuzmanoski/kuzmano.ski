import { vi } from "vitest";

/**
 * Stubs `matchMedia` with one media query list whose `matches` is `false`, for every query. Returns
 * a function that sets `matches` and calls each `change` listener with an event that has the same
 * `matches`.
 */
export function stubMatchMedia() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: false,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };

  vi.stubGlobal("matchMedia", () => media);

  return (matches: boolean) => {
    media.matches = matches;

    for (const listener of listeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  };
}
