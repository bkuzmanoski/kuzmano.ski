import { afterEach, describe, expect, test, vi } from "vitest";

import { stubMatchMedia } from "#/test-utils/match-media.ts";

import { notifyColorChange, subscribeToColorChange } from "./color-change.ts";

afterEach(() => vi.unstubAllGlobals());

describe("subscribeToColorChange", () => {
  test("calls the listener once for each notification", () => {
    stubMatchMedia();

    const onChange = vi.fn();

    subscribeToColorChange(onChange);
    notifyColorChange();

    expect(onChange).toHaveBeenCalledOnce();
  });

  test("calls the listener when the system color scheme changes", () => {
    const changeSystemColorScheme = stubMatchMedia();
    const onChange = vi.fn();

    subscribeToColorChange(onChange);
    changeSystemColorScheme(true);

    expect(onChange).toHaveBeenCalledOnce();
  });

  test("stops calling the listener once the returned function is called", () => {
    const changeSystemColorScheme = stubMatchMedia();
    const onChange = vi.fn();

    subscribeToColorChange(onChange)();
    notifyColorChange();
    changeSystemColorScheme(true);

    expect(onChange).not.toHaveBeenCalled();
  });

  test("calls the listener for a notification when `matchMedia` is undefined", () => {
    const onChange = vi.fn();

    subscribeToColorChange(onChange);
    notifyColorChange();

    expect(onChange).toHaveBeenCalledOnce();
  });
});
