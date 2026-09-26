import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { applyTheme } from "#/lib/settings/theme.ts";

import { startAboutPageHeaderAnimation } from "./about-page-header-animation.ts";

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

// At a `--dither-cell` of 4px and a device pixel ratio of 1, the component is 500 by 200 dither pixels.
const COMPONENT_WIDTH_PX = 2_000;
const COMPONENT_HEIGHT_PX = 800;
const DITHER_FIELD_WIDTH_DITHER_PIXELS = 500;

const pendingAnimationFrames = new Map<number, FrameRequestCallback>();
const mediaQueryListeners = new Set<() => void>();
const putImageData = vi.fn<(...parameters: Array<unknown>) => void>();
const drawImage = vi.fn();
const pictureImages: Array<HTMLImageElement> = [];
const resizeObserverCallbacks = new Set<() => void>();
const stopAnimationFunctions: Array<() => void> = [];

let nextAnimationFrameId = 1;

const startAnimation = (elements: ReturnType<typeof headerElements>) => {
  const stopAnimation = startAboutPageHeaderAnimation(elements, "/image.png");

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

const fakeContext = () =>
  ({
    canvas: document.createElement("canvas"),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage,
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4).map((_value, index) => (index % 4 === 3 ? 255 : 0)),
    }),
    createImageData: (width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData,
  }) as unknown as CanvasRenderingContext2D;

const setHeaderSize = (header: HTMLElement, width: number, height: number) => {
  Object.defineProperty(header, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(header, "clientHeight", { value: height, configurable: true });
};

const headerElements = () => {
  const header = document.createElement("header");
  const canvas = document.createElement("canvas");
  const column = document.createElement("div");

  vi.spyOn(column, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, COMPONENT_WIDTH_PX, 0));
  header.style.setProperty("--dither-cell", "4px");
  setHeaderSize(header, COMPONENT_WIDTH_PX, COMPONENT_HEIGHT_PX);
  header.append(canvas, column);
  document.body.append(header);

  return { header, canvas, column };
};

const loadPicture = (naturalWidth: number, naturalHeight: number) => {
  const pictureImage = pictureImages.at(-1)!;

  Object.defineProperty(pictureImage, "complete", { value: true });
  Object.defineProperty(pictureImage, "naturalWidth", { value: naturalWidth });
  Object.defineProperty(pictureImage, "naturalHeight", { value: naturalHeight });
  pictureImage.dispatchEvent(new Event("load"));
};

class FakeResizeObserver {
  readonly #report: () => void;

  constructor(callback: ResizeObserverCallback) {
    this.#report = () => callback([], this as never);
  }

  observe() {
    resizeObserverCallbacks.add(this.#report);
  }

  disconnect() {
    resizeObserverCallbacks.delete(this.#report);
  }
}

const reportResize = () => resizeObserverCallbacks.forEach((report) => report());

const resizeHeader = (header: HTMLElement, width: number, height: number) => {
  setHeaderSize(header, width, height);
  reportResize();
};

// Each listener replaces itself with a listener on a query for the new ratio, so the listeners are
// copied before they are called.
const changeDevicePixelRatio = (ratio: number) => {
  vi.stubGlobal("devicePixelRatio", ratio);
  [...mediaQueryListeners].forEach((listener) => listener());
};

const lastPutPixels = () => (putImageData.mock.lastCall?.[0] as ImageData | undefined)?.data ?? new Uint8ClampedArray();
const filledPixelCountIn = (rgba: Uint8ClampedArray) =>
  rgba.filter((value, index) => index % 4 === 3 && value === 255).length;
const lastPutRegionCenterY = () => {
  const [, , , , dirtyY = 0, , dirtyHeight = 0] = (putImageData.mock.lastCall ?? []) as Array<number>;
  return dirtyY + dirtyHeight / 2;
};
const hasFilledPixels = (rgba: Uint8ClampedArray) => filledPixelCountIn(rgba) > 0;
const movePointer = (header: HTMLElement, pointerType: string) => {
  header.dispatchEvent(new PointerEvent("pointermove", { pointerType, clientX: 400, clientY: 400 }));
};

beforeEach(() => {
  prefersReducedMotion.matches = false;
  prefersReducedMotion.unsubscribe.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const animationFrameId = nextAnimationFrameId;

    nextAnimationFrameId += 1;
    pendingAnimationFrames.set(animationFrameId, callback);

    return animationFrameId;
  });
  vi.stubGlobal("Image", function Image() {
    const pictureImage = document.createElement("img");

    pictureImages.push(pictureImage);

    return pictureImage;
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
  drawImage.mockClear();
  pictureImages.length = 0;
  resizeObserverCallbacks.clear();
  document.documentElement.removeAttribute("data-theme");
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

test("starting the animation puts the dither field on the canvas without filled pixels before the picture loads", () => {
  startAnimation(headerElements());

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(hasFilledPixels(lastPutPixels())).toBe(false);
});

test("starting the animation puts the dither field on the canvas with filled pixels before the picture loads when reduced motion is preferred", () => {
  prefersReducedMotion.matches = true;
  startAnimation(headerElements());

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(hasFilledPixels(lastPutPixels())).toBe(true);
});

test("starting the animation does not put pixels on the canvas when `--dither-cell` is not a positive `px` length", () => {
  const elements = headerElements();

  elements.header.style.setProperty("--dither-cell", "0px");
  startAnimation(elements);

  expect(putImageData).not.toHaveBeenCalled();
});

test("loading the picture reveals the dither field over successive animation frames, then stops requesting them", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);

  startAnimation(headerElements());
  loadPicture(200, 100);

  const filledPixelCountAt = (timeMs: number) => {
    now.mockReturnValue(timeMs);
    runAnimationFrames();

    return filledPixelCountIn(lastPutPixels());
  };

  const [atStart = 0, halfway = 0, threeQuartersOfTheWay = 0] = [0, 700, 1_050].map(filledPixelCountAt);

  expect(atStart).toBe(0);
  expect(halfway).toBeGreaterThan(atStart);
  expect(threeQuartersOfTheWay).toBeGreaterThan(halfway);
  expect(pendingAnimationFrames.size).toBe(1);
  expect(filledPixelCountAt(1_400)).toBeGreaterThan(threeQuartersOfTheWay);
  expect(pendingAnimationFrames.size).toBe(0);
});

test("loading the picture scales it once, to the size of its placement", () => {
  startAnimation(headerElements());
  loadPicture(200, 100);

  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(drawImage.mock.lastCall?.slice(1)).toEqual([0, 0, 300, 150]); // A picture twice as wide as it is tall is limited to 60% of the 500 dither pixels' width.
});

test("a resize that changes the width of the dither field puts the whole dither field on the canvas at the new width", () => {
  const elements = headerElements();

  startAnimation(elements);
  putImageData.mockClear();
  resizeHeader(elements.header, 1_000, COMPONENT_HEIGHT_PX);

  expect(elements.canvas.width).toBe(250);
  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(putImageData.mock.lastCall).toHaveLength(3);
});

test("a resize that leaves the size of the dither field in dither pixels unchanged does not put pixels on the canvas", () => {
  const elements = headerElements();

  startAnimation(elements);
  putImageData.mockClear();
  resizeHeader(elements.header, COMPONENT_WIDTH_PX - 1, COMPONENT_HEIGHT_PX);

  expect(putImageData).not.toHaveBeenCalled();
});

test("a resize that changes the height of the dither field but not the size of the picture's placement recomposes the dither field without scaling the picture again", () => {
  const elements = headerElements();

  startAnimation(elements);
  loadPicture(200, 100);
  resizeHeader(elements.header, COMPONENT_WIDTH_PX, 1_000);

  expect(elements.canvas.height).toBe(250);
  expect(drawImage).toHaveBeenCalledTimes(1);
});

test("a change to the device pixel ratio that changes the size of a dither pixel puts the dither field on the canvas at the new width", () => {
  const elements = headerElements();

  startAnimation(elements);
  putImageData.mockClear();
  changeDevicePixelRatio(1.1); // At a ratio of 1.1, a 4px dither cell rounds to 4 device pixels (4 / 1.1 CSS pixels).

  expect(elements.canvas.width).toBe(550);
  expect(putImageData).toHaveBeenCalledTimes(1);
});

test("a change to the device pixel ratio that leaves the size of a dither pixel unchanged does not put pixels on the canvas", () => {
  startAnimation(headerElements());
  putImageData.mockClear();
  changeDevicePixelRatio(2);

  expect(putImageData).not.toHaveBeenCalled();
});

test("moving a mouse pointer over the header requests an animation frame that puts only the region changed by the pointer highlight on the canvas", () => {
  const elements = headerElements();

  startAnimation(elements);
  putImageData.mockClear();
  movePointer(elements.header, "mouse");

  expect(runAnimationFrames()).toBe(1);
  expect(putImageData).toHaveBeenCalledTimes(1);

  const [, , , dirtyX, dirtyY, dirtyWidth, dirtyHeight] = putImageData.mock.lastCall ?? [];

  expect([dirtyX, dirtyY]).toEqual([expect.any(Number), expect.any(Number)]);
  expect(dirtyWidth).toBeGreaterThan(0);
  expect(dirtyWidth).toBeLessThan(DITHER_FIELD_WIDTH_DITHER_PIXELS);
  expect(dirtyHeight).toBeGreaterThan(0);
  expect(pendingAnimationFrames.size).toBe(1);
});

test("scrolling the header under a stationary mouse pointer moves the pointer highlight down the header by the distance scrolled", () => {
  const elements = headerElements();

  let headerTopPx = 0;
  let timeMs = 0;

  vi.spyOn(performance, "now").mockImplementation(() => (timeMs += 16)); // Each frame runs 16ms after the one before, so the pointer highlight eases at its real rate.
  vi.spyOn(elements.header, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, headerTopPx, 2_000, 800));
  startAnimation(elements);
  movePointer(elements.header, "mouse");

  runAnimationFramesUntilIdle();

  const pointerHighlightCenterBeforeScroll = lastPutRegionCenterY();

  headerTopPx = -100;
  elements.header.parentElement!.dispatchEvent(new Event("scroll"));
  runAnimationFramesUntilIdle();

  // Scrolling by 100px moves the pointer 25 dither pixels down the header. The region put on the canvas
  // is rounded out to whole pixels, so its center can differ from the pointer highlight's by one.
  expect(Math.abs(lastPutRegionCenterY() - pointerHighlightCenterBeforeScroll - 25)).toBeLessThanOrEqual(1);
});

test("moving a touch pointer over the header does not request an animation frame", () => {
  const elements = headerElements();

  startAnimation(elements);
  movePointer(elements.header, "touch");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("moving a mouse pointer over the header does not request an animation frame when reduced motion is preferred", () => {
  prefersReducedMotion.matches = true;

  const elements = headerElements();

  startAnimation(elements);
  movePointer(elements.header, "mouse");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("moving a mouse pointer over the header does not request an animation frame once reduced motion becomes preferred", () => {
  const elements = headerElements();

  startAnimation(elements);
  movePointer(elements.header, "mouse");
  runAnimationFrames();

  prefersReducedMotion.matches = true;
  prefersReducedMotion.onChange();

  runAnimationFramesUntilIdle();

  movePointer(elements.header, "mouse");

  expect(pendingAnimationFrames.size).toBe(0);
});

test("applying a theme setting puts the whole dither field on the canvas again", () => {
  startAnimation(headerElements());
  putImageData.mockClear();
  applyTheme("dark");
  runAnimationFrames();

  expect(putImageData).toHaveBeenCalledTimes(1);
  expect(putImageData.mock.lastCall).toHaveLength(3);
});

test("stopping the animation cancels the requested animation frame and stops listening for `pointermove` and `scroll` events", () => {
  const elements = headerElements();
  const stopAnimation = startAnimation(elements);

  movePointer(elements.header, "mouse");
  stopAnimation();

  expect(pendingAnimationFrames.size).toBe(0);

  movePointer(elements.header, "mouse");
  document.body.dispatchEvent(new Event("scroll"));

  expect(pendingAnimationFrames.size).toBe(0);
});

test("stopping the animation stops listening for changes to the device pixel ratio, color scheme, theme setting, and reduced motion preference", () => {
  const stopAnimation = startAnimation(headerElements());

  stopAnimation();
  applyTheme("dark");

  expect(mediaQueryListeners.size).toBe(0);
  expect(prefersReducedMotion.unsubscribe).toHaveBeenCalledTimes(1);
  expect(pendingAnimationFrames.size).toBe(0);
});
