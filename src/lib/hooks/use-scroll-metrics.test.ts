import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useScrollMetrics } from "./use-scroll-metrics";

import type { RefObject } from "react";

class ObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
  callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }
}

class ResizeObserverStub extends ObserverStub {
  constructor(callback: () => void) {
    super(callback);
    resizeObservers.push(this);
  }
}

class MutationObserverStub extends ObserverStub {
  constructor(callback: () => void) {
    super(callback);
    mutationObservers.push(this);
  }
}

const resizeObservers: Array<ObserverStub> = [];
const mutationObservers: Array<ObserverStub> = [];

beforeEach(() => {
  resizeObservers.length = 0;
  mutationObservers.length = 0;
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("MutationObserver", MutationObserverStub);
});

afterEach(() => vi.unstubAllGlobals());

function renderWithElement() {
  const element = document.createElement("div");

  element.append(document.createElement("span"));
  document.body.append(element);

  const ref: RefObject<HTMLElement | null> = { current: element };

  return renderHook(() => useScrollMetrics(ref));
}

test("disconnects both observers once unmounted", () => {
  const { unmount } = renderWithElement();

  expect(resizeObservers).toHaveLength(1);
  expect(mutationObservers).toHaveLength(1);

  unmount();

  expect(resizeObservers[0]!.disconnect).toHaveBeenCalledOnce();
  expect(mutationObservers[0]!.disconnect).toHaveBeenCalledOnce();
});

test("cancels a measurement frame that is still pending on unmount", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = renderWithElement();

  act(() => {
    resizeObservers[0]!.callback(); // Schedules a measurement on the next frame.
  });
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
