import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Applies only to the `src` project (see `vitest.config.ts`); tooling tests run in Node without a DOM.

window.scrollTo = vi.fn(); // Assigned instead of stubbed, so the `vi.unstubAllGlobals` call below retains it.

globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
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
