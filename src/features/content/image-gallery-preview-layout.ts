import { useEffect, useLayoutEffect, useRef } from "react";

import type { Position, Size, Transform } from "#/lib/geometry.ts";
import { clamp } from "#/lib/math.ts";

import type { DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

const AREA_CENTER: Position = { x: 0, y: 0 };
const UNZOOMED: Transform = { scale: 1, x: 0, y: 0 };
const SCROLL_ZOOM_RATE_PER_PX = 0.002;
const PINCH_SCROLL_ZOOM_RATE_PER_PX = 0.01; // Trackpad pinch deltas are smaller than that of a scroll event.
const SCROLL_LINE_HEIGHT_PX = 16; // The distance of a line for a wheel event with deltas in lines.

interface PreviewImageLayout {
  naturalSize: Size;
  fittedSize: Size;
  areaSize: Size;
  maxScale: number; // The scale at which the fitted size reaches the natural size.
}

interface ZoomGesture {
  zoom: Transform;
  origin: Position;
  touchDistance: number | null;
}

interface PreviewImageState {
  layout: PreviewImageLayout | null; // `null` until the image's natural size is known.
  zoom: Transform;
  pointers: Map<number, Position>;
  gesture: ZoomGesture | null;
  hasPinched: boolean; // Whether the current or previous gesture included a pinch.
}

// Returns `zoom` at `scale`, moved so the point of the image that was at `from` is at `to`, and kept
// from uncovering the image area along an axis the image fills.
function zoomedBy(zoom: Transform, from: Position, to: Position, scale: number, layout: PreviewImageLayout) {
  const nextScale = clamp(scale, 1, layout.maxScale);
  const ratio = nextScale / zoom.scale;
  const maxX = Math.max(0, (layout.fittedSize.width * nextScale - layout.areaSize.width) / 2);
  const maxY = Math.max(0, (layout.fittedSize.height * nextScale - layout.areaSize.height) / 2);

  return {
    scale: nextScale,
    x: clamp(to.x - (from.x - zoom.x) * ratio, -maxX, maxX),
    y: clamp(to.y - (from.y - zoom.y) * ratio, -maxY, maxY),
  };
}

// The midpoint of the pointers, and the distance between the first two, or `null` for a single pointer.
function touchesOf(pointers: Map<number, Position>) {
  const [first, second] = [...pointers.values()];

  if (!first) {
    return null;
  }

  if (!second) {
    return { position: first, distance: null };
  }

  return {
    position: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  };
}

function positionIn(previewImage: HTMLElement, event: { clientX: number; clientY: number }): Position {
  const area = previewImage.getBoundingClientRect();
  return { x: event.clientX - area.x - area.width / 2, y: event.clientY - area.y - area.height / 2 };
}

function render(state: PreviewImageState, previewImage: HTMLElement) {
  if (!state.layout) {
    for (const name of ["width", "height", "offset-x", "offset-y"]) {
      previewImage.style.removeProperty(`--image-gallery-preview-image-${name}`);
    }

    previewImage.removeAttribute("data-image-gallery-preview-zoomed");

    return;
  }

  const { naturalSize, fittedSize } = state.layout;
  const { scale, x, y } = state.zoom;

  // Rounded rather than floored, so a scale computed as the natural size over the fitted size reaches the natural
  // size despite floating-point error. The fitted size of each side is floored separately, so the height at the
  // largest scale can round past the natural height.
  const width = Math.min(naturalSize.width, Math.round(fittedSize.width * scale));
  const height = Math.min(naturalSize.height, Math.round(fittedSize.height * scale));

  previewImage.style.setProperty("--image-gallery-preview-image-width", `${width}px`);
  previewImage.style.setProperty("--image-gallery-preview-image-height", `${height}px`);
  previewImage.style.setProperty("--image-gallery-preview-image-offset-x", `${Math.round(x)}px`);
  previewImage.style.setProperty("--image-gallery-preview-image-offset-y", `${Math.round(y)}px`);
  previewImage.toggleAttribute("data-image-gallery-preview-zoomed", scale > 1);
}

function fit(state: PreviewImageState, preview: HTMLDialogElement, previewImage: HTMLElement) {
  const image = previewImage.querySelector("img");

  if (!preview.open || !image?.naturalWidth || !image.naturalHeight) {
    state.layout = null;
  } else {
    const area = previewImage.getBoundingClientRect();
    const scale = clamp(Math.min(area.width / image.naturalWidth, area.height / image.naturalHeight), 0, 1);
    const fittedSize = {
      width: Math.floor(image.naturalWidth * scale),
      height: Math.floor(image.naturalHeight * scale),
    };

    state.layout = {
      naturalSize: { width: image.naturalWidth, height: image.naturalHeight },
      fittedSize,
      areaSize: { width: area.width, height: area.height },
      maxScale: fittedSize.width > 0 ? Math.max(1, image.naturalWidth / fittedSize.width) : 1,
    };
    state.zoom = zoomedBy(state.zoom, AREA_CENTER, AREA_CENTER, state.zoom.scale, state.layout);
  }

  render(state, previewImage);
}

function zoomByWheel(state: PreviewImageState, previewImage: HTMLElement, event: WheelEvent) {
  const { layout, zoom } = state;

  if (!layout) {
    return;
  }

  const pixelsPerDelta =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? SCROLL_LINE_HEIGHT_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? layout.areaSize.height
        : 1;
  const rate = event.ctrlKey ? PINCH_SCROLL_ZOOM_RATE_PER_PX : SCROLL_ZOOM_RATE_PER_PX;
  const position = positionIn(previewImage, event);
  const zoomInDelta = event.ctrlKey ? -event.deltaY : event.deltaY;

  state.zoom = zoomedBy(zoom, position, position, zoom.scale * Math.exp(zoomInDelta * pixelsPerDelta * rate), layout);
  render(state, previewImage);
}

function restartGesture(state: PreviewImageState) {
  const touches = touchesOf(state.pointers);

  // Restart from the current zoom when pointers change to prevent the image from jumping.
  state.gesture = touches && { zoom: state.zoom, origin: touches.position, touchDistance: touches.distance };

  if (touches && touches.distance !== null) {
    state.hasPinched = true;
  }
}

function moveGesture(state: PreviewImageState, previewImage: HTMLElement) {
  const { layout, gesture } = state;
  const touches = touchesOf(state.pointers);

  if (!layout || !gesture || !touches) {
    return;
  }

  const scale =
    gesture.touchDistance && touches.distance
      ? (gesture.zoom.scale * touches.distance) / gesture.touchDistance
      : gesture.zoom.scale;

  state.zoom = zoomedBy(gesture.zoom, gesture.origin, touches.position, scale, layout);
  render(state, previewImage);
}

/**
 * Lays out the preview image at whole-pixel dimensions, using its natural size when possible or scaled down to
 * fit the image area. This matches the stylesheet's whole-pixel centering. Until the natural dimensions are
 * available, the stylesheet determines the image bounds.
 */
export function usePreviewImageLayout(
  previewRef: RefObject<HTMLDialogElement | null>,
  previewImageRef: RefObject<HTMLElement | null>,
  imageIndex: number,
) {
  const stateRef = useRef<PreviewImageState>({
    layout: null,
    zoom: UNZOOMED,
    pointers: new Map(),
    gesture: null,
    hasPinched: false,
  });

  useEffect(() => {
    const preview = previewRef.current;
    const previewImage = previewImageRef.current;
    const state = stateRef.current;

    if (!preview || !previewImage) {
      return;
    }

    const controller = new AbortController();
    const refit = () => fit(state, preview, previewImage);

    previewImage.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        zoomByWheel(state, previewImage, event);
      },
      {
        passive: false, // Not passive to keep the browser from zooming the page on a trackpad pinch.
        signal: controller.signal,
      },
    );
    previewImage.addEventListener("load", refit, { capture: true, signal: controller.signal }); // `load` does not bubble, so it is listened for in the capture phase.
    window.addEventListener("resize", refit, { signal: controller.signal });

    return () => controller.abort();
  }, [previewRef, previewImageRef]);

  useLayoutEffect(() => {
    const state = stateRef.current;

    state.zoom = UNZOOMED;
    restartGesture(state);

    if (previewRef.current && previewImageRef.current) {
      fit(state, previewRef.current, previewImageRef.current);
    }
  }, [previewRef, previewImageRef, imageIndex]);

  function endPointer(event: ReactPointerEvent) {
    if (stateRef.current.pointers.delete(event.pointerId)) {
      restartGesture(stateRef.current);
    }
  }

  return {
    fitPreviewImage: ({ resetsZoom = false }: { resetsZoom?: boolean } = {}) => {
      const state = stateRef.current;

      if (resetsZoom) {
        state.zoom = UNZOOMED;
        restartGesture(state);
      }

      if (previewRef.current && previewImageRef.current) {
        fit(state, previewRef.current, previewImageRef.current);
      }
    },
    isSwipeEnabled: () => stateRef.current.zoom.scale === 1 && !stateRef.current.hasPinched,
    previewImageHandlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        const state = stateRef.current;

        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }

        if (state.pointers.size === 0) {
          state.hasPinched = false;
        }

        event.currentTarget.setPointerCapture(event.pointerId); // A mouse dragged past the image area still pans.
        state.pointers.set(event.pointerId, positionIn(event.currentTarget, event));
        restartGesture(state);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const state = stateRef.current;

        if (state.pointers.has(event.pointerId)) {
          state.pointers.set(event.pointerId, positionIn(event.currentTarget, event));
          moveGesture(state, event.currentTarget);
        }
      },
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onDragStart: (event: DragEvent) => event.preventDefault(),
    },
  };
}
