import { bitmapPixelSizePxAt, subscribeToDevicePixelRatioChange } from "../bitmap-pixel.ts";
import { rgbOf } from "../computed-color.ts";
import { getPrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.ts";
import { subscribeToColorChange } from "../settings/color-change.ts";

import { renderDitherField, revealProgressAt } from "./dither-field.ts";

import type { DitherField } from "./dither-field.ts";

export interface DitherBackdropElements {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  highlightCenterElement: Element | null;
}

interface DitherFieldLayout {
  width: number;
  height: number;
  bitmapPixelSizePx: number;
}

interface BackdropHighlight {
  centerX: number;
  centerY: number;
  standardDeviation: number;
}

export const BACKDROP_TOP_DENSITY = 0.5;

const BACKDROP_FALLOFF_EXPONENT = 1.5;

export const HIGHLIGHT_REACH_STANDARD_DEVIATIONS = 3;

const HIGHLIGHT_STANDARD_DEVIATION_PX = 56;
const HIGHLIGHT_STRENGTH = 0.45;

export const REVEAL_DURATION_MS = 720;

const REVEAL_STEP_COUNT = 24;

export function composeBackdropDitherField(
  width: number,
  height: number,
  highlight: BackdropHighlight | null,
): DitherField {
  const density = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    density.fill(
      BACKDROP_TOP_DENSITY * (1 - y / Math.max(1, height - 1)) ** BACKDROP_FALLOFF_EXPONENT,
      y * width,
      (y + 1) * width,
    );
  }

  if (highlight) {
    clearHighlight(density, width, height, highlight);
  }

  return { width, height, density, maxDensity: BACKDROP_TOP_DENSITY };
}

function clearHighlight(
  density: Float32Array,
  width: number,
  height: number,
  { centerX, centerY, standardDeviation }: BackdropHighlight,
): void {
  const reach = HIGHLIGHT_REACH_STANDARD_DEVIATIONS * standardDeviation;
  const twoVariance = 2 * standardDeviation ** 2;
  const top = Math.max(0, Math.floor(centerY - reach));
  const bottom = Math.min(height, Math.ceil(centerY + reach));
  const left = Math.max(0, Math.floor(centerX - reach));
  const right = Math.min(width, Math.ceil(centerX + reach));

  for (let y = top; y < bottom; y += 1) {
    const dy = y - centerY;

    for (let x = left; x < right; x += 1) {
      const dx = x - centerX;
      const index = y * width + x;

      density[index] = Math.max(
        0,
        (density[index] ?? 0) - HIGHLIGHT_STRENGTH * Math.exp(-(dx * dx + dy * dy) / twoVariance),
      );
    }
  }
}

/**
 * Sizes `canvas` to `container`, renders the dither field, and reveals it over `REVEAL_DURATION_MS`. When reduced
 * motion is preferred, the field is shown immediately. Returns a function that stops the animation.
 */
export function startDitherBackdropAnimation({
  container,
  canvas,
  highlightCenterElement,
}: DitherBackdropElements): () => void {
  const context = canvas.getContext("2d");
  const initialDitherColor = rgbOf(getComputedStyle(canvas).color);

  if (!context || !initialDitherColor) {
    return () => undefined;
  }

  const revealStartTimeMs = performance.now();
  const prefersReducedMotion = getPrefersReducedMotion();

  let ditherField: DitherField | null = null;
  let canvasPixels: ImageData | null = null;
  let composedLayout: DitherFieldLayout | null = null;
  let animationFrameId = 0;
  let ditherColor = initialDitherColor;
  let renderedRevealProgress: number | null = null;

  const highlightIn = ({ bitmapPixelSizePx }: DitherFieldLayout): BackdropHighlight | null => {
    if (!highlightCenterElement) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const centerRect = highlightCenterElement.getBoundingClientRect();

    return {
      centerX: (centerRect.left + centerRect.width / 2 - containerRect.left) / bitmapPixelSizePx,
      centerY: (centerRect.top + centerRect.height / 2 - containerRect.top) / bitmapPixelSizePx,
      standardDeviation: HIGHLIGHT_STANDARD_DEVIATION_PX / bitmapPixelSizePx,
    };
  };

  /**
   * Resizes the canvas and composes its dither field when the bitmap-pixel layout changes. Returns `false` without
   * modifying either when the layout is unchanged.
   */
  const composeDitherFieldForLayout = (): boolean => {
    const bitmapPixelSizePx = bitmapPixelSizePxAt(devicePixelRatio);
    const layout: DitherFieldLayout = {
      width: Math.max(1, Math.floor(container.clientWidth / bitmapPixelSizePx)),
      height: Math.max(1, Math.floor(container.clientHeight / bitmapPixelSizePx)),
      bitmapPixelSizePx,
    };
    const isLayoutUnchanged =
      composedLayout?.width === layout.width &&
      composedLayout.height === layout.height &&
      composedLayout.bitmapPixelSizePx === layout.bitmapPixelSizePx;

    if (isLayoutUnchanged) {
      return false;
    }

    composedLayout = layout;

    const { width, height } = layout;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    if (canvasPixels?.width !== width || canvasPixels.height !== height) {
      canvasPixels = context.createImageData(width, height);
    }

    canvas.style.width = `${width * bitmapPixelSizePx}px`;
    canvas.style.height = `${height * bitmapPixelSizePx}px`;
    renderedRevealProgress = null;
    ditherField = composeBackdropDitherField(width, height, highlightIn(layout));

    return true;
  };

  const renderFrame = (revealProgress: number) => {
    if (!ditherField || !canvasPixels || renderedRevealProgress === revealProgress) {
      return;
    }

    renderDitherField(ditherField, { color: ditherColor, revealProgress }, canvasPixels.data);
    context.putImageData(canvasPixels, 0, 0);
    renderedRevealProgress = revealProgress;
  };

  const onAnimationFrame = (timeMs: number) => {
    const revealProgress = prefersReducedMotion
      ? 1
      : revealProgressAt(timeMs - revealStartTimeMs, REVEAL_DURATION_MS, REVEAL_STEP_COUNT);

    animationFrameId = 0;

    renderFrame(revealProgress);

    if (revealProgress < 1) {
      animationFrameId = requestAnimationFrame(onAnimationFrame);
    }
  };

  const composeAndRender = () => {
    if (composeDitherFieldForLayout()) {
      // Render before the next paint because resizing clears the canvas.
      cancelAnimationFrame(animationFrameId);
      onAnimationFrame(performance.now());
    }
  };

  const resizeObserver = new ResizeObserver(composeAndRender);

  resizeObserver.observe(container);

  const unsubscribeFromDevicePixelRatioChange = subscribeToDevicePixelRatioChange(composeAndRender);
  const unsubscribeFromColorChange = subscribeToColorChange(() => {
    ditherColor = rgbOf(getComputedStyle(canvas).color) ?? ditherColor;
    renderedRevealProgress = null;

    if (animationFrameId === 0) {
      animationFrameId = requestAnimationFrame(onAnimationFrame);
    }
  });

  return () => {
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    unsubscribeFromDevicePixelRatioChange();
    unsubscribeFromColorChange();
  };
}
