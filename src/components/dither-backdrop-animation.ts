import { rgbOfCssColor } from "#/lib/color.ts";
import { subscribeToDevicePixelRatioChange } from "#/lib/device.ts";
import { dirtyRegionBetween, renderDitherField, revealProgressAt } from "#/lib/dither/dither-field.ts";
import type { DitherField, PointerHighlight } from "#/lib/dither/dither-field.ts";
import { getPrefersReducedMotion, subscribeToPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { subscribeToColorSchemeChange } from "#/lib/settings/theme.ts";

export interface DitherBackdropElements {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
}

interface DitherFieldLayout {
  width: number;
  height: number;
  cssPixelsPerDitherPixel: number;
}

export const BACKDROP_TOP_DENSITY = 0.5;

const BACKDROP_FALLOFF_EXPONENT = 4.0;
const REVEAL_DURATION_MS = 1_400;
const REVEAL_STEP_COUNT = 14;
const POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX = 90;
const POINTER_HIGHLIGHT_STRENGTH = 0.45;
const POINTER_HIGHLIGHT_EASING_PER_FRAME = 0.2;
const FRAME_DURATION_AT_60HZ_MS = 1_000 / 60;
const POINTER_HIGHLIGHT_SETTLED_STRENGTH_DIFFERENCE = 0.002; // Snap the pointer highlight's strength to its target when the remaining difference is below this threshold.
const POINTER_HIGHLIGHT_SETTLED_DISTANCE_DITHER_PIXELS = 0.5; // Snap to the pointer within this distance so the animation loop can stop.

export function composeBackdropDitherField(width: number, height: number): DitherField {
  const density = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const backdropDensity = BACKDROP_TOP_DENSITY * (1 - y / Math.max(1, height - 1)) ** BACKDROP_FALLOFF_EXPONENT;
    density.fill(backdropDensity, y * width, (y + 1) * width);
  }

  return { width, height, density };
}

export function startDitherBackdropAnimation({ container, canvas }: DitherBackdropElements): () => void {
  const context = canvas.getContext("2d");
  const scratchContext = document.createElement("canvas").getContext("2d");

  if (!context || !scratchContext) {
    return () => undefined;
  }

  // Round each dither cell to whole device pixels. `parseFloat` only correctly reads pixel lengths, so `--dither-cell` must use px units.
  const ditherCellPx = Number.parseFloat(getComputedStyle(container).getPropertyValue("--dither-cell"));

  if (!(ditherCellPx > 0)) {
    return () => undefined;
  }

  const revealStartTimeMs = performance.now();

  let prefersReducedMotion = getPrefersReducedMotion();
  let ditherField: DitherField | null = null;
  let canvasPixels: ImageData | null = null;
  let composedLayout: DitherFieldLayout | null = null; // Set after the initial dither field composition.
  let animationFrameId = 0;
  let previousFrameTimeMs: number | null = null; // Reset while stopped so resuming advances the pointer highlight by one frame, not the pause duration.
  let ditherColor = rgbOfCssColor(scratchContext, getComputedStyle(canvas).color);
  let renderedFrame: { revealProgress: number; pointerHighlight: PointerHighlight } | null = null;

  const pointer = { clientX: 0, clientY: 0, x: 0, y: 0, isOverContainer: false };
  const pointerHighlight: PointerHighlight = {
    x: 0,
    y: 0,
    standardDeviation: POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX / ditherCellPx,
    strength: 0,
  };

  const composeDitherField = (): boolean => {
    const devicePixelsPerDitherPixel = Math.max(1, Math.round(ditherCellPx * devicePixelRatio));
    const cssPixelsPerDitherPixel = devicePixelsPerDitherPixel / devicePixelRatio;
    // Rounded down to whole dither pixels, so the canvas never extends past the container into its margin.
    const layout: DitherFieldLayout = {
      width: Math.max(1, Math.floor(container.clientWidth / cssPixelsPerDitherPixel)),
      height: Math.max(1, Math.floor(container.clientHeight / cssPixelsPerDitherPixel)),
      cssPixelsPerDitherPixel,
    };

    const isLayoutUnchanged =
      composedLayout?.width === layout.width &&
      composedLayout.height === layout.height &&
      composedLayout.cssPixelsPerDitherPixel === layout.cssPixelsPerDitherPixel;

    if (isLayoutUnchanged) {
      return false;
    }

    composedLayout = layout;

    const { width, height } = layout;

    pointerHighlight.standardDeviation = POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX / cssPixelsPerDitherPixel;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    if (canvasPixels?.width !== width || canvasPixels.height !== height) {
      canvasPixels = context.createImageData(width, height);
    }

    canvas.style.width = `${width * cssPixelsPerDitherPixel}px`;
    canvas.style.height = `${height * cssPixelsPerDitherPixel}px`;
    renderedFrame = null;
    ditherField = composeBackdropDitherField(width, height);

    return true;
  };
  const revealProgressAtTime = (timeMs: number) =>
    prefersReducedMotion ? 1 : revealProgressAt(timeMs - revealStartTimeMs, REVEAL_DURATION_MS, REVEAL_STEP_COUNT);
  const pointerHighlightTargetStrength = () => (pointer.isOverContainer ? POINTER_HIGHLIGHT_STRENGTH : 0);
  const easePointerHighlight = (elapsedMs: number) => {
    const easing = 1 - (1 - POINTER_HIGHLIGHT_EASING_PER_FRAME) ** (elapsedMs / FRAME_DURATION_AT_60HZ_MS);
    const targetStrength = pointerHighlightTargetStrength();

    pointerHighlight.x += (pointer.x - pointerHighlight.x) * easing;
    pointerHighlight.y += (pointer.y - pointerHighlight.y) * easing;
    pointerHighlight.strength += (targetStrength - pointerHighlight.strength) * easing;

    if (Math.abs(targetStrength - pointerHighlight.strength) <= POINTER_HIGHLIGHT_SETTLED_STRENGTH_DIFFERENCE) {
      pointerHighlight.strength = targetStrength;
    }

    if (
      Math.hypot(pointer.x - pointerHighlight.x, pointer.y - pointerHighlight.y) <=
      POINTER_HIGHLIGHT_SETTLED_DISTANCE_DITHER_PIXELS
    ) {
      pointerHighlight.x = pointer.x;
      pointerHighlight.y = pointer.y;
    }
  };
  const renderFrame = (revealProgress: number) => {
    if (!ditherField || !canvasPixels) {
      return;
    }

    const isUnchanged =
      renderedFrame?.revealProgress === revealProgress &&
      renderedFrame.pointerHighlight.strength === pointerHighlight.strength &&
      (pointerHighlight.strength === 0 ||
        (renderedFrame.pointerHighlight.x === pointerHighlight.x &&
          renderedFrame.pointerHighlight.y === pointerHighlight.y));

    if (isUnchanged) {
      return;
    }

    if (renderedFrame?.revealProgress === revealProgress) {
      const dirtyRegion = dirtyRegionBetween(ditherField, renderedFrame.pointerHighlight, pointerHighlight);

      if (dirtyRegion) {
        renderDitherField(
          ditherField,
          { color: ditherColor, revealProgress, pointerHighlight, region: dirtyRegion },
          canvasPixels.data,
        );
        context.putImageData(canvasPixels, 0, 0, dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
      }
    } else {
      renderDitherField(ditherField, { color: ditherColor, revealProgress, pointerHighlight }, canvasPixels.data);
      context.putImageData(canvasPixels, 0, 0);
    }

    renderedFrame = { revealProgress, pointerHighlight: { ...pointerHighlight } };
  };

  const placePointerOverContainer = () => {
    if (!composedLayout) {
      return;
    }

    const containerRect = container.getBoundingClientRect();

    pointer.x = (pointer.clientX - containerRect.left) / composedLayout.cssPixelsPerDitherPixel;
    pointer.y = (pointer.clientY - containerRect.top) / composedLayout.cssPixelsPerDitherPixel;
  };
  const onAnimationFrame = (timeMs: number) => {
    animationFrameId = 0;

    if (pointer.isOverContainer) {
      placePointerOverContainer();
    }

    easePointerHighlight(previousFrameTimeMs === null ? FRAME_DURATION_AT_60HZ_MS : timeMs - previousFrameTimeMs);
    previousFrameTimeMs = timeMs;

    const revealProgress = revealProgressAtTime(timeMs);

    renderFrame(revealProgress);

    const isRevealing = revealProgress < 1;
    const isPointerHighlightMoving =
      pointerHighlight.strength !== pointerHighlightTargetStrength() ||
      (pointerHighlight.strength > 0 && (pointerHighlight.x !== pointer.x || pointerHighlight.y !== pointer.y));

    if (isRevealing || isPointerHighlightMoving) {
      animationFrameId = requestAnimationFrame(onAnimationFrame);
    } else {
      previousFrameTimeMs = null;
    }
  };

  const scheduleAnimationFrame = () => {
    if (animationFrameId === 0) {
      animationFrameId = requestAnimationFrame(onAnimationFrame);
    }
  };
  const composeAndRender = () => {
    if (composeDitherField()) {
      // Renders in the resize observer's callback, before the next paint, as resizing the canvas clears it.
      cancelAnimationFrame(animationFrameId);
      onAnimationFrame(performance.now());
    }
  };

  const resizeObserver = new ResizeObserver(composeAndRender);

  resizeObserver.observe(container);

  const unsubscribeFromDevicePixelRatioChange = subscribeToDevicePixelRatioChange(composeAndRender);
  const unsubscribeFromColorSchemeChange = subscribeToColorSchemeChange(() => {
    ditherColor = rgbOfCssColor(scratchContext, getComputedStyle(canvas).color);
    renderedFrame = null;
    scheduleAnimationFrame();
  });
  const unsubscribeFromPrefersReducedMotion = subscribeToPrefersReducedMotion(() => {
    prefersReducedMotion = getPrefersReducedMotion();

    if (prefersReducedMotion) {
      pointer.isOverContainer = false;
      pointerHighlight.strength = 0;
    }

    scheduleAnimationFrame();
  });

  const onPointerMove = (event: PointerEvent) => {
    if (prefersReducedMotion || event.pointerType === "touch") {
      return;
    }

    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;

    if (!pointer.isOverContainer) {
      placePointerOverContainer();
      pointerHighlight.x = pointer.x;
      pointerHighlight.y = pointer.y;
      pointer.isOverContainer = true;
    }

    scheduleAnimationFrame();
  };
  const onPointerLeave = () => {
    pointer.isOverContainer = false;
    scheduleAnimationFrame();
  };
  const onScroll = () => {
    if (pointer.isOverContainer) {
      scheduleAnimationFrame();
    }
  };

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    unsubscribeFromDevicePixelRatioChange();
    unsubscribeFromColorSchemeChange();
    unsubscribeFromPrefersReducedMotion();
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}
