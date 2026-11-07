import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { bitmapPixelSizePxAt, subscribeToDevicePixelRatioChange } from "./bitmap-pixel.ts";

const listenersByQuery = new Map<string, Set<() => void>>();

const changeDevicePixelRatio = (ratio: number) => {
  const previousQuery = `(resolution: ${devicePixelRatio}dppx)`;

  vi.stubGlobal("devicePixelRatio", ratio);
  [...(listenersByQuery.get(previousQuery) ?? [])].forEach((listener) => listener());
};

const listenerCount = () => [...listenersByQuery.values()].reduce((count, listeners) => count + listeners.size, 0);

describe("bitmapPixelSizePxAt", () => {
  test("rounds a bitmap pixel to the nearest whole number of device pixels", () => {
    expect(bitmapPixelSizePxAt(1.25)).toBe(1 / 1.25);
    expect(bitmapPixelSizePxAt(1.5)).toBe(2 / 1.5);
  });

  test("returns at least one device pixel when the device pixel ratio is below 1", () => {
    expect(bitmapPixelSizePxAt(0.5)).toBe(2);
  });
});

describe("subscribeToDevicePixelRatioChange", () => {
  beforeEach(() => {
    vi.stubGlobal("devicePixelRatio", 1);

    // Return a distinct media query list per query because subscriptions replace their query after each change.
    vi.stubGlobal("matchMedia", (media: string) => ({
      media,
      addEventListener: (_type: string, listener: () => void) => {
        listenersByQuery.set(media, (listenersByQuery.get(media) ?? new Set()).add(listener));
      },
      removeEventListener: (_type: string, listener: () => void) => listenersByQuery.get(media)?.delete(listener),
    }));
  });

  afterEach(() => {
    listenersByQuery.clear();
  });

  test("calls `onChange` when the device pixel ratio changes", () => {
    const onChange = vi.fn();

    subscribeToDevicePixelRatioChange(onChange);
    changeDevicePixelRatio(2);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("calls `onChange` again when the device pixel ratio changes a second time", () => {
    const onChange = vi.fn();

    subscribeToDevicePixelRatioChange(onChange);
    changeDevicePixelRatio(2);
    changeDevicePixelRatio(1.5);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(listenersByQuery.get("(resolution: 1.5dppx)")?.size).toBe(1);
  });

  test("stops listening once the returned function is called", () => {
    const unsubscribe = subscribeToDevicePixelRatioChange(vi.fn());

    changeDevicePixelRatio(2);
    unsubscribe();

    expect(listenerCount()).toBe(0);
  });
});
