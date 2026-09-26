import { rgbOfCssColor } from "#/lib/color.ts";
import { subscribeToDevicePixelRatioChange } from "#/lib/device.ts";
import {
  densityFromImage,
  dirtyRegionBetween,
  renderDitherField,
  revealProgressAt,
} from "#/lib/dither/dither-field.ts";
import type { DitherField, PointerHighlight } from "#/lib/dither/dither-field.ts";
import { getPrefersReducedMotion, subscribeToPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { subscribeToColorSchemeChange } from "#/lib/settings/theme.ts";

import { composeHeaderDitherField, picturePlacementFor } from "./about-page-header-composition.ts";

export interface AboutPageHeaderElements {
  header: HTMLElement;
  canvas: HTMLCanvasElement;
  column: HTMLElement; // The text column, whose right edge the picture is placed against.
}

interface DitherFieldLayout {
  width: number;
  height: number;
  cssPixelsPerDitherPixel: number;
  columnEnd: number | null; // The right edge of the text column, or `null` while the picture has not loaded.
}

const REVEAL_DURATION_MS = 1_400; // How long the dither field takes to be revealed.
const REVEAL_STEP_COUNT = 14; // How many steps the dither field is revealed in, so it redraws like a screen rather than fading.
const PICTURE_CONTRAST = 1.25; // The `contrast` `densityFromImage` reads the picture at.
const POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX = 90; // The spread of the pointer highlight, in CSS pixels.
const POINTER_HIGHLIGHT_STRENGTH = 0.45; // The density the pointer highlight removes at its center.
const POINTER_HIGHLIGHT_EASING_PER_FRAME = 0.2; // The share of the remaining distance the pointer highlight covers in one 60Hz frame; a longer frame covers more.
const FRAME_DURATION_AT_60HZ_MS = 1_000 / 60; // The frame duration `POINTER_HIGHLIGHT_EASING_PER_FRAME` is measured against.
const POINTER_HIGHLIGHT_SETTLED_STRENGTH_DIFFERENCE = 0.002; // Within this difference from its target strength, the pointer highlight's strength is set to the target.
const POINTER_HIGHLIGHT_SETTLED_DISTANCE_DITHER_PIXELS = 0.5; // Within this distance of the pointer, the pointer highlight is placed at the pointer, so the loop can stop.

export function startAboutPageHeaderAnimation(
  { header, canvas, column }: AboutPageHeaderElements,
  src: string,
): () => void {
  const context = canvas.getContext("2d");
  const scratchContext = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  if (!context || !scratchContext) {
    return () => undefined;
  }

  // Round each dither cell to whole device pixels so its dots match the site's dither fills.
  // `parseFloat` only correctly reads pixel lengths, so `--dither-cell` must use px units.
  const ditherCellPx = Number.parseFloat(getComputedStyle(header).getPropertyValue("--dither-cell"));

  if (!(ditherCellPx > 0)) {
    return () => undefined;
  }

  const pictureImage = new Image();

  let prefersReducedMotion = getPrefersReducedMotion();
  let ditherField: DitherField | null = null;
  let canvasPixels: ImageData | null = null;
  let composedLayout: DitherFieldLayout | null = null; // `null` until the dither field is first composed.
  let scaledPicture: { width: number; height: number; density: Float32Array } | null = null; // Cached picture density for its most recently placed size. `null` until the picture is first placed.
  let animationFrameId = 0;
  let previousFrameTimeMs: number | null = null; // `null` while stopped so restarting advances the pointer highlight by one frame, not the pause duration.
  let revealStartTimeMs: number | null = null; // `null` until the picture has loaded or if it failed to load.
  let ditherColor = rgbOfCssColor(scratchContext, getComputedStyle(canvas).color);
  let renderedFrame: { revealProgress: number; pointerHighlight: PointerHighlight } | null = null;

  const pointer = { clientX: 0, clientY: 0, x: 0, y: 0, isOverHeader: false };
  const pointerHighlight: PointerHighlight = {
    x: 0,
    y: 0,
    standardDeviation: POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX / ditherCellPx,
    strength: 0,
  };

  const scaledPictureDensity = (width: number, height: number): Float32Array => {
    if (scaledPicture?.width !== width || scaledPicture.height !== height) {
      scratchContext.canvas.width = width;
      scratchContext.canvas.height = height;
      scratchContext.imageSmoothingQuality = "high"; // Resizing resets the context; high-quality smoothing prevents aliasing when downscaling the photograph.
      scratchContext.drawImage(pictureImage, 0, 0, width, height);
      scaledPicture = {
        width,
        height,
        density: densityFromImage(scratchContext.getImageData(0, 0, width, height).data, PICTURE_CONTRAST),
      };
    }

    return scaledPicture.density;
  };

  // Rebuilds the dither field only when the header's size or device pixel ratio changes its layout.
  // Returns `false` without clearing the canvas when a resize or zoom leaves the layout unchanged.
  const composeDitherField = (): boolean => {
    const devicePixelsPerDitherPixel = Math.max(1, Math.round(ditherCellPx * devicePixelRatio));
    const cssPixelsPerDitherPixel = devicePixelsPerDitherPixel / devicePixelRatio;
    const isPictureLoaded = pictureImage.complete && pictureImage.naturalWidth > 0;
    const layout: DitherFieldLayout = {
      width: Math.max(1, Math.ceil(header.clientWidth / cssPixelsPerDitherPixel)),
      height: Math.max(1, Math.ceil(header.clientHeight / cssPixelsPerDitherPixel)),
      cssPixelsPerDitherPixel,
      columnEnd: isPictureLoaded
        ? (column.getBoundingClientRect().right - header.getBoundingClientRect().left) / cssPixelsPerDitherPixel
        : null,
    };

    const isLayoutUnchanged =
      composedLayout?.width === layout.width &&
      composedLayout.height === layout.height &&
      composedLayout.cssPixelsPerDitherPixel === layout.cssPixelsPerDitherPixel &&
      composedLayout.columnEnd === layout.columnEnd;

    if (isLayoutUnchanged) {
      return false;
    }

    composedLayout = layout;

    const { width, height, columnEnd } = layout;

    pointerHighlight.standardDeviation = POINTER_HIGHLIGHT_STANDARD_DEVIATION_PX / cssPixelsPerDitherPixel;

    // Assigning either dimension clears the canvas, even when the value is unchanged.
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

    const placement =
      columnEnd === null
        ? null
        : picturePlacementFor(pictureImage.naturalWidth / pictureImage.naturalHeight, width, height, columnEnd);

    ditherField = composeHeaderDitherField(
      width,
      height,
      placement && placement.width >= 1 && placement.height >= 1
        ? { density: scaledPictureDensity(placement.width, placement.height), placement }
        : null,
    );

    return true;
  };

  const revealProgressAtTime = (timeMs: number) => {
    if (prefersReducedMotion) {
      return 1;
    }

    return revealStartTimeMs === null
      ? 0
      : revealProgressAt(timeMs - revealStartTimeMs, REVEAL_DURATION_MS, REVEAL_STEP_COUNT);
  };

  const pointerHighlightTargetStrength = () => (pointer.isOverHeader ? POINTER_HIGHLIGHT_STRENGTH : 0);

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

  const placePointerOverHeader = () => {
    if (!composedLayout) {
      return;
    }

    const headerRect = header.getBoundingClientRect();

    pointer.x = (pointer.clientX - headerRect.left) / composedLayout.cssPixelsPerDitherPixel;
    pointer.y = (pointer.clientY - headerRect.top) / composedLayout.cssPixelsPerDitherPixel;
  };

  const onAnimationFrame = (timeMs: number) => {
    animationFrameId = 0;

    if (pointer.isOverHeader) {
      placePointerOverHeader();
    }

    easePointerHighlight(previousFrameTimeMs === null ? FRAME_DURATION_AT_60HZ_MS : timeMs - previousFrameTimeMs);
    previousFrameTimeMs = timeMs;

    const revealProgress = revealProgressAtTime(timeMs);

    renderFrame(revealProgress);

    const isRevealing = revealStartTimeMs !== null && revealProgress < 1;
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

  // Renders in the resize observer's callback, before the next paint, as resizing the canvas clears it.
  const composeAndRender = () => {
    if (composeDitherField()) {
      cancelAnimationFrame(animationFrameId);
      onAnimationFrame(performance.now());
    }
  };

  const startRevealing = () => {
    composeDitherField();
    revealStartTimeMs = performance.now();
    scheduleAnimationFrame();
  };

  pictureImage.addEventListener("load", startRevealing);
  pictureImage.addEventListener("error", startRevealing);
  pictureImage.src = src;

  const resizeObserver = new ResizeObserver(composeAndRender);

  resizeObserver.observe(header);

  const unsubscribeFromDevicePixelRatioChange = subscribeToDevicePixelRatioChange(composeAndRender);

  const unsubscribeFromColorSchemeChange = subscribeToColorSchemeChange(() => {
    ditherColor = rgbOfCssColor(scratchContext, getComputedStyle(canvas).color);
    renderedFrame = null;
    scheduleAnimationFrame();
  });

  const unsubscribeFromPrefersReducedMotion = subscribeToPrefersReducedMotion(() => {
    prefersReducedMotion = getPrefersReducedMotion();

    if (prefersReducedMotion) {
      pointer.isOverHeader = false;
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

    if (!pointer.isOverHeader) {
      placePointerOverHeader();
      pointerHighlight.x = pointer.x;
      pointerHighlight.y = pointer.y;
      pointer.isOverHeader = true;
    }

    scheduleAnimationFrame();
  };

  const onPointerLeave = () => {
    pointer.isOverHeader = false;
    scheduleAnimationFrame();
  };

  const onScroll = () => {
    if (pointer.isOverHeader) {
      scheduleAnimationFrame();
    }
  };

  header.addEventListener("pointermove", onPointerMove);
  header.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    cancelAnimationFrame(animationFrameId);
    pictureImage.removeEventListener("load", startRevealing);
    pictureImage.removeEventListener("error", startRevealing);
    resizeObserver.disconnect();
    unsubscribeFromDevicePixelRatioChange();
    unsubscribeFromColorSchemeChange();
    unsubscribeFromPrefersReducedMotion();
    header.removeEventListener("pointermove", onPointerMove);
    header.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}
