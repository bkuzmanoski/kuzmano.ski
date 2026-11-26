import { vi } from "vitest";

/** Stubs the missing jsdom `window.visualViewport` with an event target and zoom scale. */
export function stubVisualViewport({ scale = 1 } = {}) {
  const viewport = Object.assign(new EventTarget(), { scale });

  vi.stubGlobal("visualViewport", viewport);

  return viewport;
}
