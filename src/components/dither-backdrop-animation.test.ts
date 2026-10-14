import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { applyTheme } from "#/lib/settings/theme.ts";
import { stubResizeObserver } from "#/test-utils/resize-observer.ts";

import {
  BACKDROP_TOP_DENSITY,
  composeBackdropDitherField,
  startDitherBackdropAnimation,
} from "./dither-backdrop-animation.ts";

const prefersReducedMotion = vi.hoisted(() => ({
  matches: false,
  onChange: vi.fn<() => void>(),
  unsubscribe: vi.fn(),
}));

vi.mock("#/lib/hooks/use-prefers-reduced-motion.ts", () => ({
  getPrefersReducedMotion: () => prefersReducedMotion.matches,
  subscribeToPrefersReducedMotion: (onChange: () => void) => {
    prefersReducedMotion.onChange = vi.fn(onChange);
    return prefersReducedMotion.unsubscribe;
  },
}));

// At a `--dither-cell` of 4px and a device pixel ratio of 1, the component is 500x200 dither pixels.
const COMPONENT_WIDTH_PX = 2_000;
const COMPONENT_HEIGHT_PX = 800;
const DITHER_FIELD_WIDTH_DITHER_PIXELS = 500;

const pendingAnimationFrames = new Map<number, FrameRequestCallback>();
const mediaQueryListeners = new Set<() => void>();
const putImageData = vi.fn<(...parameters: Array<unknown>) => void>();
const stopAnimationFunctions: Array<() => void> = [];

let nextAnimationFrameId = 1;
let reportResize: ReturnType<typeof stubResizeObserver>;

const startAnimation = (elements: ReturnType<typeof containerElements>) => {
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

const runAnimationFramesUntilIdle = () => {
  for (let frame = 0; frame < 1_000; frame += 1) {
    if (runAnimationFrames() === 0) {
      return;
    }
  }

  throw new Error("The renderer requested animation frames for 1,000 frames.");
};

const fakeContext = () => {
  const context = {
    canvas: document.createElement("canvas"),
    fillStyle: "",
    clearRect: vi.fn(),
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

const setContainerSize = (container: HTMLElement, width: number, height: number) => {
  Object.defineProperty(container, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: height, configurable: true });
};

const containerElements = () => {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");

  container.style.setProperty("--dither-cell", "4px");
  setContainerSize(container, COMPONENT_WIDTH_PX, COMPONENT_HEIGHT_PX);
  container.append(canvas);
  document.body.append(container);

  return { container, canvas };
};

const resizeContainer = (container: HTMLElement, width: number, height: number) => {
  setContainerSize(container, width, height);
  reportResize();
};

const changeDevicePixelRatio = (ratio: number) => {
  vi.stubGlobal("devicePixelRatio", ratio);
  [...mediaQueryListeners].forEach((listener) => listener()); // Copy listeners because they re-register for the new ratio.
};

const lastPutPixels = () => (putImageData.mock.lastCall?.[0] as ImageData | undefined)?.data ?? new Uint8ClampedArray();
const filledPixelCountIn = (rgba: Uint8ClampedArray) =>
  rgba.filter((value, index) => index % 4 === 3 && value > 0).length;
const lastPutRegionCenterY = () => {
  const [, , , , dirtyY = 0, , dirtyHeight = 0] = (putImageData.mock.lastCall ?? []) as Array<number>;
  return dirtyY + dirtyHeight / 2;
};
const hasFilledPixels = (rgba: Uint8ClampedArray) => filledPixelCountIn(rgba) > 0;
const movePointer = (container: HTMLElement, pointerType: string) => {
  container.dispatchEvent(new PointerEvent("pointermove", { pointerType, clientX: 400, clientY: 400 }));
};

beforeEach(() => {
  prefersReducedMotion.matches = false;
  prefersReducedMotion.unsubscribe.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext);
  reportResize = stubResizeObserver();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const animationFrameId = nextAnimationFrameId;

    nextAnimationFrameId += 1;
    pendingAnimationFrames.set(animationFrameId, callback);

    return animationFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (animationFrameId: number) => pendingAnimationFrames.delete(animationFrameId));
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: (_type: string, listener: () => void) => mediaQueryListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaQueryListeners.delete(listener),
  }));
});

afterEach(() => {
  stopAnimationFunctions.splice(0).forEach((stopAnimation) => stopAnimation());
  pendingAnimationFrames.clear();
  mediaQueryListeners.clear();
  putImageData.mockClear();
  document.documentElement.removeAttribute("data-theme");
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

test("`composeBackdropDitherField` returns a density that falls from the top edge to `0` at the bottom edge", () => {
  const { density } = composeBackdropDitherField(4, 10);

  expect(density[0]).toBeCloseTo(BACKDROP_TOP_DENSITY);
  expect(density[9 * 4]).toBe(0);
  expect(density[2 * 4]).toBeGreaterThan(density[6 * 4] ?? 1);
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
});

test("starting the animation does not put pixels on the canvas when `--dither-cell` is not a positive `px` length", () => {
  const elements = containerElements();

  elements.container.style.setProperty("--dither-cell", "0px");
  startAnimation(elements);

  expect(putImageData).not.toHaveBeenCalled();
});

test("starting the animation reveals the dither field over successive animation frames, then stops requesting them", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);

  startAnimation(containerElements());

  const filledPixelCountAt = (timeMs: number) => {
    now.mockReturnValue(timeMs);
    runAnimationFrames();

    return filledPixelCountIn(lastPutPixels());
  };

  // The backdrop is at most half as dense as a filled pixel, so its pixels are revealed in the second half of the reveal.
  const [atStart = 0, threeQuartersOfTheWay = 0, nineTenthsOfTheWay = 0] = [0, 1_050, 1_260].map(filledPixelCountAt);

  expect(atStart).toBe(0);
  expect(threeQuartersOfTheWay).toBeGreaterThan(atStart);
  expect(nineTenthsOfTheWay).toBeGreaterThan(threeQuartersOfTheWay);
  expect(pendingAnimationFrames.size).toBe(1);
  expect(filledPixelCountAt(1_400)).toBeGreaterThan(nineTenthsOfTheWay);
  expect(pendingAnimationFrames.size).toBe(0);
});

test("a resize that changes the width of the dither field puts the whole dither field on the canvas at the new width", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  resizeContainer(elements.container, 1_000, COMPONENT_HEIGHT_PX);

  expect(elements.canvas.width).toBe(250);
  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(putImageData.mock.lastCall).toHaveLength(3);
});

test("a resize that leaves the size of the dither field in dither pixels unchanged does not put pixels on the canvas", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  resizeContainer(elements.container, COMPONENT_WIDTH_PX + 1, COMPONENT_HEIGHT_PX);

  expect(putImageData).not.toHaveBeenCalled();
});

test("a resize to a size between whole dither pixels sizes the canvas to the whole dither pixels inside the container", () => {
  const elements = containerElements();

  startAnimation(elements);
  resizeContainer(elements.container, 1_003, 803);

  expect([elements.canvas.style.width, elements.canvas.style.height]).toEqual(["1000px", "800px"]);
});

test("a change to the device pixel ratio that changes the size of a dither pixel puts the dither field on the canvas at the new width", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  changeDevicePixelRatio(1.1); // At a ratio of 1.1, a 4px dither cell rounds to 4 device pixels (4 / 1.1 CSS pixels).

  expect(elements.canvas.width).toBe(550);
  expect(putImageData).toHaveBeenCalledTimes(1);
});

test("a change to the device pixel ratio that leaves the size of a dither pixel unchanged does not put pixels on the canvas", () => {
  startAnimation(containerElements());
  putImageData.mockClear();
  changeDevicePixelRatio(2);

  expect(putImageData).not.toHaveBeenCalled();
});

test("moving a mouse pointer over the container requests an animation frame that puts only the region changed by the pointer highlight on the canvas", () => {
  const elements = containerElements();

  startAnimation(elements);
  putImageData.mockClear();
  movePointer(elements.container, "mouse");

  expect(runAnimationFrames()).toBe(1);
  expect(putImageData).toHaveBeenCalledTimes(1);

  const [, , , dirtyX, dirtyY, dirtyWidth, dirtyHeight] = putImageData.mock.lastCall ?? [];

  expect([dirtyX, dirtyY]).toEqual([expect.any(Number), expect.any(Number)]);
  expect(dirtyWidth).toBeGreaterThan(0);
  expect(dirtyWidth).toBeLessThan(DITHER_FIELD_WIDTH_DITHER_PIXELS);
  expect(dirtyHeight).toBeGreaterThan(0);
  expect(pendingAnimationFrames.size).toBe(1);
});

test("scrolling the container under a stationary mouse pointer moves the pointer highlight down the container by the distance scrolled", () => {
  const elements = containerElements();

  let containerTopPx = 0;
  let timeMs = 0;

  vi.spyOn(performance, "now").mockImplementation(() => (timeMs += 16)); // Each frame runs 16ms after the one before, so the pointer highlight eases at its real rate.
  vi.spyOn(elements.container, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, containerTopPx, 2_000, 800),
  );
  startAnimation(elements);
  runAnimationFramesUntilIdle(); // Finishes the reveal, which puts the whole dither field on the canvas.
  movePointer(elements.container, "mouse");

  runAnimationFramesUntilIdle();

  const pointerHighlightCenterBeforeScroll = lastPutRegionCenterY();

  containerTopPx = -100;
  elements.container.parentElement!.dispatchEvent(new Event("scroll"));
  runAnimationFramesUntilIdle();

  // Scrolling by 100px moves the pointer 25 dither pixels down the container. The region put on the canvas
  // is rounded out to whole pixels, so its center can differ from the pointer highlight's by one.
  expect(Math.abs(lastPutRegionCenterY() - pointerHighlightCenterBeforeScroll - 25)).toBeLessThanOrEqual(1);
});

test("moving a touch pointer over the container does not request an animation frame once the reveal has finished", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  const elements = containerElements();

  startAnimation(elements);
  now.mockReturnValue(1_400);
  runAnimationFramesUntilIdle();
  movePointer(elements.container, "touch");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("moving a mouse pointer over the container does not request an animation frame when reduced motion is preferred", () => {
  prefersReducedMotion.matches = true;

  const elements = containerElements();

  startAnimation(elements);
  movePointer(elements.container, "mouse");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("moving a mouse pointer over the container does not request an animation frame once reduced motion becomes preferred", () => {
  const elements = containerElements();

  startAnimation(elements);
  movePointer(elements.container, "mouse");
  runAnimationFrames();

  prefersReducedMotion.matches = true;
  prefersReducedMotion.onChange();

  runAnimationFramesUntilIdle();

  movePointer(elements.container, "mouse");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("applying a theme setting puts the whole dither field on the canvas again", () => {
  startAnimation(containerElements());
  putImageData.mockClear();
  applyTheme("dark");
  runAnimationFrames();

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(putImageData.mock.lastCall).toHaveLength(3);
});

test("stopping the animation cancels the requested animation frame and stops listening for `pointermove` and `scroll` events", () => {
  const elements = containerElements();
  const stopAnimation = startAnimation(elements);

  movePointer(elements.container, "mouse");
  stopAnimation();

  expect(pendingAnimationFrames.size).toBe(0);

  movePointer(elements.container, "mouse");
  document.body.dispatchEvent(new Event("scroll"));

  expect(pendingAnimationFrames.size).toBe(0);
});

test("stopping the animation stops listening for changes to the device pixel ratio, color scheme, theme setting, and reduced motion preference", () => {
  const stopAnimation = startAnimation(containerElements());

  stopAnimation();
  applyTheme("dark");

  expect(mediaQueryListeners.size).toBe(0);
  expect(prefersReducedMotion.unsubscribe).toHaveBeenCalledTimes(1);
  expect(pendingAnimationFrames.size).toBe(0);
});
