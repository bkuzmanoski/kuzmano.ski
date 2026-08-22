import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubGlobal("scrollTo", vi.fn());

Document.prototype.elementFromPoint = () => null;
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

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
