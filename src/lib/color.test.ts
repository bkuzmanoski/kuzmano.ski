import { describe, expect, test, vi } from "vitest";

import { rgbOfCssColor } from "./color.ts";

// jsdom does not implement a 2D canvas context, so the stub reads back the bytes the browser would resolve each painted color to.
const RESOLVED_BYTES: Record<string, Array<number>> = {
  "oklch(0.2 0 0)": [22, 22, 22, 255],
  "rgb(255 0 0 / 50%)": [255, 0, 0, 128],
};

const fakeContext = () => {
  let fillStyle = "";
  let paintedBytes = [0, 0, 0, 0];
  const context = {
    clearRect: vi.fn(() => {
      paintedBytes = [0, 0, 0, 0];
    }),
    fillRect: vi.fn(() => {
      paintedBytes = RESOLVED_BYTES[fillStyle] ?? [0, 0, 0, 0];
    }),
    getImageData: () => ({ data: new Uint8ClampedArray(paintedBytes) }),
    set fillStyle(color: string) {
      fillStyle = color;
    },
  };

  return context as unknown as CanvasRenderingContext2D & typeof context;
};

describe("rgbOfCssColor", () => {
  test("returns the red, green, and blue bytes the color resolves to", () => {
    expect(rgbOfCssColor(fakeContext(), "oklch(0.2 0 0)")).toEqual([22, 22, 22]);
  });

  test("omits the alpha byte of a translucent color", () => {
    expect(rgbOfCssColor(fakeContext(), "rgb(255 0 0 / 50%)")).toEqual([255, 0, 0]);
  });

  test("clears the pixel before painting the color", () => {
    const context = fakeContext();

    rgbOfCssColor(context, "oklch(0.2 0 0)");

    expect(context.clearRect.mock.invocationCallOrder[0]).toBeLessThan(
      context.fillRect.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
