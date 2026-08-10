import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubGlobal("scrollTo", vi.fn());

Document.prototype.elementFromPoint = () => null;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
