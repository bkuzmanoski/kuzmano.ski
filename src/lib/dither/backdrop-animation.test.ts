import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { stubResizeObserver } from "#/test-utils/resize-observer.ts";

import { bitmapPixelSizePxAt } from "../bitmap-pixel.ts";
import { notifyColorChange } from "../settings/color-change.ts";

import {
  BACKDROP_TOP_DENSITY,
  HIGHLIGHT_REACH_STANDARD_DEVIATIONS,
  REVEAL_DURATION_MS,
  composeBackdropDitherField,
  startDitherBackdropAnimation,
} from "./backdrop-animation.ts";

import type * as BitmapPixel from "../bitmap-pixel.ts";
import type { DitherBackdropElements } from "./backdrop-animation.ts";

const prefersReducedMotion = vi.hoisted(() => ({ matches: false }));
const devicePixelRatioChangeListeners = vi.hoisted(() => new Set<() => void>());

vi.mock("#/lib/hooks/use-prefers-reduced-motion.ts", () => ({
  getPrefersReducedMotion: () => prefersReducedMotion.matches,
}));
vi.mock("#/lib/bitmap-pixel.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BitmapPixel>()),
  subscribeToDevicePixelRatioChange: (onChange: () => void) => {
    devicePixelRatioChangeListeners.add(onChange);
    return () => devicePixelRatioChangeListeners.delete(onChange);
  },
}));

const CONTAINER_WIDTH_PX = 2_000;
const CONTAINER_HEIGHT_PX = 800;

const DITHER_FIELD_WIDTH_BITMAP_PIXELS = CONTAINER_WIDTH_PX / bitmapPixelSizePxAt(1);

/** At a device pixel ratio of 0.5 a bitmap pixel rounds up to one device pixel (2 CSS pixels). */
const ZOOMED_OUT_DEVICE_PIXEL_RATIO = 0.5;
const ZOOMED_OUT_BITMAP_PIXEL_SIZE_PX = bitmapPixelSizePxAt(ZOOMED_OUT_DEVICE_PIXEL_RATIO);

const HIGHLIGHT_CENTER = { x: 300, y: 200 };

/** A point at the height of `HIGHLIGHT_CENTER`, far enough to the side for the highlight to leave the field there. */
const POINT_BESIDE_HIGHLIGHT = { x: 1_500, y: HIGHLIGHT_CENTER.y };

const pendingAnimationFrames = new Map<number, FrameRequestCallback>();
const putImageData = vi.fn<(...parameters: Array<unknown>) => void>();
const stopAnimationFunctions: Array<() => void> = [];

let nextAnimationFrameId = 1;
let reportResize: ReturnType<typeof stubResizeObserver>;

const startAnimation = (elements: DitherBackdropElements) => {
  const stopAnimation = startDitherBackdropAnimation(elements);

  stopAnimationFunctions.push(stopAnimation);
  reportResize();

  return stopAnimation;
};

const runAnimationFrames = () => {
  const callbacks = [...pendingAnimationFrames.values()];

  pendingAnimationFrames.clear();
  callbacks.forEach((callback) => callback(performance.now()));

  return callbacks.length;
};

const fakeContext = () => {
  const context = {
    canvas: document.createElement("canvas"),
    fillStyle: "",
    fillRect: vi.fn(),
    getImageData: () => {
      const [red = 0, green = 0, blue = 0] = context.fillStyle.match(/\d+/g)?.map(Number) ?? [];
      return { data: new Uint8ClampedArray([red, green, blue, 255]) };
    },
    createImageData: (width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData,
  };

  return context as unknown as CanvasRenderingContext2D;
};

/** A box around `center`, standing in for the bounding box of the highlight center element. */
const rectCenteredOn = (center: { x: number; y: number }) => new DOMRect(center.x - 50, center.y - 60, 100, 120);

const setContainerSize = (container: HTMLElement, width: number, height: number) => {
  Object.defineProperty(container, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: height, configurable: true });
};

/** A container at the top left of the viewport, with a highlight center element centered on `highlightCenter`. */
const containerElements = (highlightCenter = HIGHLIGHT_CENTER) => {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  const highlightCenterElement = document.createElement("span");

  setContainerSize(container, CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX);
  container.append(canvas, highlightCenterElement);
  document.body.append(container);
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX),
  );
  vi.spyOn(highlightCenterElement, "getBoundingClientRect").mockReturnValue(rectCenteredOn(highlightCenter));

  return { container, canvas, highlightCenterElement };
};

const resizeContainer = (container: HTMLElement, width: number, height: number) => {
  setContainerSize(container, width, height);
  reportResize();
};

const changeDevicePixelRatio = (ratio: number) => {
  vi.stubGlobal("devicePixelRatio", ratio);
  devicePixelRatioChangeListeners.forEach((listener) => listener());
};

const lastPutPixels = () => (putImageData.mock.lastCall?.[0] as ImageData | undefined)?.data ?? new Uint8ClampedArray();
const filledPixelCountIn = (rgba: Uint8ClampedArray) =>
  rgba.filter((value, index) => index % 4 === 3 && value > 0).length;
const hasFilledPixels = (rgba: Uint8ClampedArray) => filledPixelCountIn(rgba) > 0;
const filledPixelCountAround = (rgba: Uint8ClampedArray, center: { x: number; y: number }) => {
  let filledPixelCount = 0;

  for (let y = center.y - 4; y <= center.y + 4; y += 1) {
    for (let x = center.x - 4; x <= center.x + 4; x += 1) {
      filledPixelCount += rgba[(y * DITHER_FIELD_WIDTH_BITMAP_PIXELS + x) * 4 + 3] === 255 ? 1 : 0;
    }
  }

  return filledPixelCount;
};

beforeEach(() => {
  prefersReducedMotion.matches = false;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext);
  reportResize = stubResizeObserver();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const animationFrameId = nextAnimationFrameId;

    nextAnimationFrameId += 1;
    pendingAnimationFrames.set(animationFrameId, callback);

    return animationFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (animationFrameId: number) => pendingAnimationFrames.delete(animationFrameId));
});

afterEach(() => {
  stopAnimationFunctions.splice(0).forEach((stopAnimation) => stopAnimation());
  pendingAnimationFrames.clear();
  devicePixelRatioChangeListeners.clear();
  putImageData.mockClear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

test("`composeBackdropDitherField` returns a density that falls from the top edge to `0` at the bottom edge", () => {
  const { density } = composeBackdropDitherField(4, 10, null);

  expect(density[0]).toBeCloseTo(BACKDROP_TOP_DENSITY);
  expect(density[9 * 4]).toBe(0);
  expect(density[2 * 4]).toBeGreaterThan(density[6 * 4] ?? 1);
});

test("`composeBackdropDitherField` lowers the density around the highlight center, and leaves the density unchanged `HIGHLIGHT_REACH_STANDARD_DEVIATIONS` standard deviations from it", () => {
  const highlight = { centerX: 10, centerY: 0, standardDeviation: 2 };
  const reachX = highlight.centerX + HIGHLIGHT_REACH_STANDARD_DEVIATIONS * highlight.standardDeviation;
  const { density } = composeBackdropDitherField(64, 1, highlight);

  expect(density[highlight.centerX]).toBeLessThan(BACKDROP_TOP_DENSITY);
  expect(density[reachX - 1]).toBeLessThan(BACKDROP_TOP_DENSITY);
  expect(density[reachX]).toBe(BACKDROP_TOP_DENSITY);
});

test("starting the animation puts the dither field on the canvas without filled pixels at the start of its reveal", () => {
  vi.spyOn(performance, "now").mockReturnValue(0);
  startAnimation(containerElements());

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(hasFilledPixels(lastPutPixels())).toBe(false);
});

test("starting the animation puts the dither field on the canvas with filled pixels when reduced motion is preferred", () => {
  prefersReducedMotion.matches = true;
  startAnimation(containerElements());

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(hasFilledPixels(lastPutPixels())).toBe(true);
  expect(pendingAnimationFrames.size).toBe(0);
});

test("starting the animation reveals the dither field over successive animation frames for `REVEAL_DURATION_MS`, then stops requesting them", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);

  startAnimation(containerElements());

  const filledPixelCountAt = (timeMs: number) => {
    now.mockReturnValue(timeMs);
    runAnimationFrames();

    return filledPixelCountIn(lastPutPixels());
  };

  const [atStart = 0, aQuarterOfTheWay = 0, halfway = 0] = [0, REVEAL_DURATION_MS / 4, REVEAL_DURATION_MS / 2].map(
    filledPixelCountAt,
  );

  expect(atStart).toBe(0);
  expect(aQuarterOfTheWay).toBeGreaterThan(atStart);
  expect(halfway).toBeGreaterThan(aQuarterOfTheWay);
  expect(pendingAnimationFrames.size).toBe(1);

  const [justBeforeTheEnd = 0, atTheEnd = 0] = [REVEAL_DURATION_MS - 1, REVEAL_DURATION_MS].map(filledPixelCountAt);

  expect(justBeforeTheEnd).toBeGreaterThan(halfway);
  expect(atTheEnd).toBeGreaterThan(justBeforeTheEnd);
  expect(pendingAnimationFrames.size).toBe(0);
});

test("starting the animation clears the dither field around the center of the highlight center element, and fills it beside that center at the same height", () => {
  prefersReducedMotion.matches = true;
  startAnimation(containerElements());

  expect(filledPixelCountAround(lastPutPixels(), HIGHLIGHT_CENTER)).toBe(0);
  expect(filledPixelCountAround(lastPutPixels(), POINT_BESIDE_HIGHLIGHT)).toBeGreaterThan(0);
});

test("starting the animation without a highlight center element fills the dither field at the center of the container", () => {
  const containerCenter = { x: CONTAINER_WIDTH_PX / 2, y: CONTAINER_HEIGHT_PX / 2 };
  const elements = { ...containerElements(containerCenter), highlightCenterElement: null };

  prefersReducedMotion.matches = true;
  startAnimation(elements);

  expect(filledPixelCountAround(lastPutPixels(), containerCenter)).toBeGreaterThan(0);
});

test("a resize that changes the width of the dither field puts the whole dither field on the canvas at the new width", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  resizeContainer(elements.container, CONTAINER_WIDTH_PX / 2, CONTAINER_HEIGHT_PX);

  expect(elements.canvas.width).toBe(DITHER_FIELD_WIDTH_BITMAP_PIXELS / 2);
  expect(putImageData).toHaveBeenCalledTimes(1);
});

test("a resize centers the highlight on the new position of the highlight center element", () => {
  const movedHighlightCenter = { x: 900, y: HIGHLIGHT_CENTER.y };
  const elements = containerElements();

  prefersReducedMotion.matches = true;
  startAnimation(elements);
  vi.spyOn(elements.highlightCenterElement, "getBoundingClientRect").mockReturnValue(
    rectCenteredOn(movedHighlightCenter),
  );
  resizeContainer(elements.container, CONTAINER_WIDTH_PX, CONTAINER_HEIGHT_PX + 1);

  expect(filledPixelCountAround(lastPutPixels(), movedHighlightCenter)).toBe(0);
  expect(filledPixelCountAround(lastPutPixels(), HIGHLIGHT_CENTER)).toBeGreaterThan(0);
});

test("a resize that leaves the size of the dither field in bitmap pixels unchanged does not put pixels on the canvas", () => {
  const elements = containerElements();

  startAnimation(elements);
  changeDevicePixelRatio(ZOOMED_OUT_DEVICE_PIXEL_RATIO);
  putImageData.mockClear();
  resizeContainer(elements.container, CONTAINER_WIDTH_PX + 1, CONTAINER_HEIGHT_PX);

  expect(putImageData).not.toHaveBeenCalled();
});

test("a resize to a size between whole bitmap pixels sizes the canvas to the whole bitmap pixels inside the container", () => {
  const elements = containerElements();

  startAnimation(elements);
  changeDevicePixelRatio(ZOOMED_OUT_DEVICE_PIXEL_RATIO);
  resizeContainer(
    elements.container,
    501 * ZOOMED_OUT_BITMAP_PIXEL_SIZE_PX + 1,
    401 * ZOOMED_OUT_BITMAP_PIXEL_SIZE_PX + 1,
  );

  expect([elements.canvas.style.width, elements.canvas.style.height]).toEqual([
    `${501 * ZOOMED_OUT_BITMAP_PIXEL_SIZE_PX}px`,
    `${401 * ZOOMED_OUT_BITMAP_PIXEL_SIZE_PX}px`,
  ]);
});

test("a change to the device pixel ratio that changes the size of a bitmap pixel puts the dither field on the canvas at the new width", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  changeDevicePixelRatio(1.1); // At a ratio of 1.1, a bitmap pixel rounds to 1 device pixel (1 / 1.1 CSS pixels).

  expect(elements.canvas.width).toBe(Math.round(DITHER_FIELD_WIDTH_BITMAP_PIXELS * 1.1));
  expect(putImageData).toHaveBeenCalledTimes(1);
});

test("a change to the device pixel ratio that leaves the size of a bitmap pixel unchanged does not put pixels on the canvas", () => {
  startAnimation(containerElements());
  putImageData.mockClear();
  changeDevicePixelRatio(2);

  expect(putImageData).not.toHaveBeenCalled();
});

test("a color change notification puts the dither field on the canvas again", () => {
  prefersReducedMotion.matches = true;
  startAnimation(containerElements());
  putImageData.mockClear();
  notifyColorChange();
  runAnimationFrames();

  expect(putImageData).toHaveBeenCalledTimes(1);
});

test("stopping the animation cancels the requested animation frame and stops listening for color change notifications and changes to the device pixel ratio", () => {
  const stopAnimation = startAnimation(containerElements());

  expect(pendingAnimationFrames.size).toBe(1);

  stopAnimation();
  notifyColorChange();

  expect(pendingAnimationFrames.size).toBe(0);
  expect(devicePixelRatioChangeListeners.size).toBe(0);
});
