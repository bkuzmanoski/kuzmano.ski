import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import type { EventEmitter } from "node:events";

// Applies only to the `src` project (see `vitest.config.ts`); tooling tests run in Node without a DOM.

interface JsdomError extends Error {
  type?: string;
}

const NAVIGATION_NOT_IMPLEMENTED_MESSAGE = "Not implemented: navigation to another Document";

// Uncanceled link clicks trigger jsdom's unimplemented navigation. Suppress only that error rather than calling
// `preventDefault`, which would invalidate `fireEvent.click` assertions; all other jsdom errors still log.
const virtualConsole = (window as Window & { jsdom?: { virtualConsole: EventEmitter } }).jsdom?.virtualConsole;

if (virtualConsole) {
  const jsdomErrorListeners = virtualConsole.listeners("jsdomError") as Array<(error: JsdomError) => void>;

  virtualConsole.removeAllListeners("jsdomError");
  virtualConsole.on("jsdomError", (error: JsdomError) => {
    if (error.type === "not-implemented" && error.message === NAVIGATION_NOT_IMPLEMENTED_MESSAGE) {
      return;
    }

    for (const listener of jsdomErrorListeners) {
      listener(error);
    }
  });
}

window.scrollTo = vi.fn(); // Assigned instead of stubbed, so the `vi.unstubAllGlobals` call below retains it.

const originalGetComputedStyle = window.getComputedStyle.bind(window);

// jsdom logs a `not-implemented` error for pseudo-element queries and falls back to the element's own computed style.
// Return an empty declaration instead, so pseudo-element queries stay quiet and do not read the element's own styles.
window.getComputedStyle = (element, pseudoElement) =>
  pseudoElement ? document.createElement("div").style : originalGetComputedStyle(element);

globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// jsdom lacks `IntersectionObserver`. This stub doesn't report intersections, like `ResizeObserver` above. For a
// reporting stub, see `stubIntersectionObserver` in `src/test-utils/intersection-observer.ts`.
globalThis.IntersectionObserver = class {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
};

Object.defineProperty(Document.prototype, "fonts", {
  configurable: true,
  value: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
});
Document.prototype.elementFromPoint = () => null;
Element.prototype.getAnimations = () => [];
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
HTMLDialogElement.prototype.show = function show() {
  this.open = true;
};
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

// Undoes stubs and spies after every test, instead of only before the next as `restoreMocks` does, because
// `process.env` outlives a test file. An env stub left by a file's last test would otherwise apply in the next file the
// worker runs.
afterEach(() => {
  cleanup(); // First, so the cleanups of the unmounting components run against the stubs they rendered with.
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  sessionStorage.clear();
});
