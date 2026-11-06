import { beforeEach, describe, expect, test, vi } from "vitest";

import { rgbOf } from "./computed-color.ts";

const RENDERED_BYTES: Record<string, Array<number>> = {
  "oklch(0.2 0 0)": [22, 22, 22, 255],
  "rgb(255 0 0 / 50%)": [255, 0, 0, 128],
};

const fakeContext = () => {
  let fillStyle = "";
  let renderedBytes = [0, 0, 0, 0];

  const context = {
    fillRect: () => {
      renderedBytes = RENDERED_BYTES[fillStyle] ?? [0, 0, 0, 0];
    },
    getImageData: () => ({ data: new Uint8ClampedArray(renderedBytes) }),
    set fillStyle(color: string) {
      fillStyle = color;
    },
  };

  return context as unknown as CanvasRenderingContext2D;
};

describe("rgbOf", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext);
  });

  test("returns the red, green, and blue bytes the color renders as", () => {
    expect(rgbOf("oklch(0.2 0 0)")).toEqual([22, 22, 22]);
  });

  test("omits the alpha byte of a translucent color", () => {
    expect(rgbOf("rgb(255 0 0 / 50%)")).toEqual([255, 0, 0]);
  });

  test("returns `null` when the browser cannot create a 2D canvas context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(rgbOf("oklch(0.2 0 0)")).toBeNull();
  });
});
