import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";

import PreviewImageGalleryIcon from "#/assets/images/image-gallery-icon-preview.svg?react";
import ArrowScrollbarIcon from "#/assets/images/scrollbar-icon-arrow.svg?react";
import { Button } from "#/components/button.tsx";
import { ZoomRect } from "#/features/window-manager/zoom-rect.tsx";
import { playKeyPressSounds } from "#/lib/audio/key-press-sounds.ts";
import { loadKeySounds, playHoverSound } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { rectRelativeTo } from "#/lib/geometry.ts";
import type { Rect } from "#/lib/geometry.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";
import type { DragDelta } from "#/lib/hooks/use-pointer-drag.ts";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { clamp } from "#/lib/math.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { swallowNextPress } from "#/lib/press.ts";

import { usePreviewImageLayout } from "./image-gallery-preview-layout.ts";
import styles from "./image-gallery.module.css";

import type { ComponentPropsWithoutRef, KeyboardEvent, ReactElement, ReactNode } from "react";

/** The horizontal travel past which a touch drag across an image shows the next or previous image. */
export const SWIPE_DISTANCE_PX = 32;

// The preview's zoom rect, which grows from the stage to the frame (`in`) or shrinks from the frame
// back to the stage (`out`), in the preview's coordinates.
interface PreviewZoomRect {
  direction: "in" | "out";
  from: Rect;
  to: Rect;
}

function imagesIn(children: ReactNode): Array<ReactElement> {
  return Children.toArray(children).flatMap((child) => {
    if (typeof child === "string" && child.trim() === "") {
      return []; // The line breaks between images authored on consecutive lines.
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      if (child.type === "img" || child.type === "picture") {
        return [child];
      }

      if (child.type === "p") {
        return imagesIn(child.props.children);
      }
    }

    throw new Error(
      "An `ImageGallery` contains only images, authored in Markdown or as `<img>` or `<picture>` elements.",
    );
  });
}

function galleryImagesIn(children: ReactNode): Array<ReactElement> {
  const images = imagesIn(children);

  if (images.length === 0) {
    throw new Error("An `ImageGallery` contains at least one image.");
  }

  return images;
}

// Scrolls only the thumbnail row; `scrollIntoView` would also scroll the page, potentially behind an open preview.
function scrollThumbnailIntoView(thumbnailList: HTMLElement, index: number) {
  const thumbnail = thumbnailList.children.item(index);

  if (!(thumbnail instanceof HTMLElement)) {
    return;
  }

  const padding = parseFloat(getComputedStyle(thumbnailList).paddingInlineStart) || 0;

  thumbnailList.scrollLeft = clamp(
    thumbnailList.scrollLeft,
    thumbnail.offsetLeft + thumbnail.offsetWidth + padding - thumbnailList.clientWidth,
    thumbnail.offsetLeft - padding,
  );
}

const isThumbnail = (target: EventTarget) => target instanceof HTMLElement && target.getAttribute("role") === "tab";

// Calls `onSwipe` with `1` when a touch drag moves toward the line's start (next image) or `-1` when it
// moves toward the end. Predominantly vertical drags are ignored so the browser can scroll the page.
// Suppresses the swipe's subsequent press to prevent it from opening the preview.
function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const swipeDeltaRef = useRef<DragDelta | null>(null);
  return usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    canStart: (event) => event.pointerType === "touch",
    start: () => {
      swipeDeltaRef.current = null;
    },
    onDragMove: (delta) => {
      swipeDeltaRef.current = delta;
    },
    onEnd: () => {
      const delta = swipeDeltaRef.current;

      if (delta && Math.abs(delta.dx) >= SWIPE_DISTANCE_PX && Math.abs(delta.dx) > Math.abs(delta.dy)) {
        swallowNextPress();
        onSwipe(delta.dx < 0 ? 1 : -1);
      }
    },
  });
}

export function ImageGallery({
  caption,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"figure">, "children" | "onKeyDown"> & { caption?: string; children: ReactNode }) {
  const idPrefix = useId();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewZoomRect, setPreviewZoomRect] = useState<PreviewZoomRect | null>(null);
  const images = galleryImagesIn(children);
  const hasControls = useIsHydrated();
  const thumbnailPressSoundHandlers = usePressSound();
  const closeButtonPressSoundHandlers = usePressSound();
  const galleryRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbnailListRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLDivElement>(null);
  const isPressOutsidePreviewRef = useRef(false);

  const { fitPreviewImage, isSwipeEnabled, previewImageHandlers } = usePreviewImageLayout(
    previewRef,
    previewImageRef,
    currentIndex,
  );

  useEffect(() => {
    if (hasControls) {
      void loadKeySounds();
    }
  }, [hasControls]);

  const imageCount = images.length;
  const canStep = hasControls && imageCount > 1;
  const isFirstImage = currentIndex === 0;
  const isLastImage = currentIndex === imageCount - 1;
  const captionId = `${idPrefix}-caption`;

  const slideIdOf = (index: number) => `${idPrefix}-slide-${index}`;
  const positionLabelOf = (index: number) => `${index + 1} of ${imageCount}`;

  function showImage(index: number) {
    setCurrentIndex(index);

    if (thumbnailListRef.current) {
      scrollThumbnailIntoView(thumbnailListRef.current, index);
    }
  }

  function step(direction: 1 | -1) {
    const nextIndex = clamp(currentIndex + direction, 0, imageCount - 1);

    if (nextIndex === currentIndex) {
      return null;
    }

    showImage(nextIndex);

    return nextIndex;
  }

  function focusThumbnail(index: number) {
    const thumbnail = thumbnailListRef.current?.children.item(index);

    if (thumbnail instanceof HTMLElement) {
      thumbnail.focus({ preventScroll: true }); // `showImage` scrolls the thumbnail into view along the row alone.
    }
  }

  function finishZoomRect(direction: PreviewZoomRect["direction"]) {
    setPreviewZoomRect(null);

    if (direction === "out") {
      previewRef.current?.close();
    }
  }

  function startZoomRect(direction: PreviewZoomRect["direction"]) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const frameRect = previewFrameRef.current?.getBoundingClientRect();

    if (!stageRect || !frameRect || getPrefersReducedMotion()) {
      finishZoomRect(direction);
      return;
    }

    const stage = rectRelativeTo(stageRect, frameRect);
    const frame = { x: 0, y: 0, width: frameRect.width, height: frameRect.height };

    setPreviewZoomRect(
      direction === "in" ? { direction, from: stage, to: frame } : { direction, from: frame, to: stage },
    );
  }

  function openPreview() {
    const preview = previewRef.current;

    if (!preview || preview.open) {
      return;
    }

    preview.showModal();
    preview.focus(); // Prevent `showModal()` from focusing Previous, where Space would advance the gallery instead of closing the preview.
    fitPreviewImage({ resetsZoom: true });
    startZoomRect("in");
  }

  function closePreview() {
    // A preview that is already closing keeps closing, rather than starting its zoom rect again.
    if (previewRef.current?.open && previewZoomRect?.direction !== "out") {
      startZoomRect("out");
    }
  }

  function togglePreview() {
    if (previewRef.current?.open) {
      closePreview();
    } else {
      openPreview();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!hasControls || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const isOnThumbnail = isThumbnail(event.target);

    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && canStep) {
      event.preventDefault();

      const nextIndex = step(event.key === "ArrowRight" ? 1 : -1);

      if (nextIndex === null) {
        return;
      }

      playHoverSound();

      if (isOnThumbnail) {
        focusThumbnail(nextIndex);
      }
    } else if ((event.key === "Home" || event.key === "End") && isOnThumbnail) {
      event.preventDefault();

      const nextIndex = event.key === "Home" ? 0 : imageCount - 1;

      if (nextIndex !== currentIndex) {
        showImage(nextIndex);
        playHoverSound();
      }

      focusThumbnail(nextIndex);
    } else if (event.key === " " && (isOnThumbnail || !(event.target instanceof HTMLButtonElement))) {
      event.preventDefault(); // A thumbnail is a button, which the Space key would otherwise press.

      // A held key repeats its `keydown`, which would open and close the preview in turn.
      if (!event.repeat) {
        playKeyPressSounds(event.nativeEvent);
        togglePreview();
      }
    }
  }

  function onSwipe(direction: 1 | -1) {
    if (canStep && step(direction) !== null) {
      playHoverSound();
    }
  }

  const stageSwipeHandlers = useSwipe(onSwipe);
  const previewSwipeHandlers = useSwipe((direction) => {
    if (isSwipeEnabled()) {
      onSwipe(direction);
    }
  });

  const previousControl = (
    <Button
      variant="strip"
      className={cx(styles.control, styles.previousControl)}
      disabled={!canStep}
      aria-disabled={(canStep && isFirstImage) || undefined} // Marked `aria-disabled` rather than disabled so the focus remains on it.
      aria-label="Previous image"
      aria-keyshortcuts="ArrowLeft"
      onClick={() => step(-1)}
    >
      <ArrowScrollbarIcon className={styles.previousIcon} />
    </Button>
  );
  const nextControl = (
    <Button
      variant="strip"
      className={cx(styles.control, styles.nextControl)}
      disabled={!canStep}
      aria-disabled={(canStep && isLastImage) || undefined} // Marked `aria-disabled` rather than disabled so the focus remains on it.
      aria-label="Next image"
      aria-keyshortcuts="ArrowRight"
      onClick={() => step(1)}
    >
      <ArrowScrollbarIcon className={styles.nextIcon} />
    </Button>
  );

  return (
    <figure
      {...props}
      ref={galleryRef}
      className={cx(styles.imageGallery, className)}
      tabIndex={-1}
      aria-roledescription="carousel"
      aria-label={caption ? undefined : "Image gallery"}
      aria-labelledby={caption ? captionId : undefined}
      data-image-gallery
      onKeyDown={onKeyDown}
    >
      <div
        className={styles.panel}
        data-content-panel
        data-content-default-styles="off"
        onPointerDown={(event) => {
          const button = event.target instanceof Element ? event.target.closest("button") : null;

          // Safari does not focus pressed buttons, and presses around thumbnails do not focus anything.
          // Focus the pressed button or the gallery so arrow keys remain available. Slides retain focus
          // after being pressed because they are focusable.
          (button && !button.disabled ? button : galleryRef.current)?.focus({ preventScroll: true });
        }}
      >
        <div
          ref={stageRef}
          className={styles.stage}
          aria-live="polite"
          {...stageSwipeHandlers}
          onClick={() => {
            if (hasControls) {
              openPreview();
            }
          }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              id={slideIdOf(index)}
              className={styles.slide}
              role="tabpanel"
              tabIndex={0}
              aria-roledescription="slide"
              aria-label={positionLabelOf(index)}
              hidden={index !== currentIndex}
            >
              {image}
            </div>
          ))}
        </div>
        <div className={styles.controls} data-feed-omit>
          {previousControl}
          <div className={styles.thumbnailRow}>
            <div ref={thumbnailListRef} className={styles.thumbnails} role="tablist" aria-label="Images">
              {images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.thumbnail}
                  role="tab"
                  tabIndex={index === currentIndex ? 0 : -1}
                  disabled={!hasControls}
                  aria-selected={index === currentIndex}
                  aria-controls={slideIdOf(index)}
                  {...thumbnailPressSoundHandlers}
                  onClick={(event) => {
                    thumbnailPressSoundHandlers.onClick(event);
                    showImage(index);
                  }}
                >
                  {image}
                </button>
              ))}
            </div>
          </div>
          {nextControl}
          <Button
            variant="strip"
            className={cx(styles.control, styles.previewControl)}
            disabled={!hasControls}
            aria-label="Preview image"
            aria-keyshortcuts="Space"
            onClick={openPreview}
          >
            <PreviewImageGalleryIcon />
          </Button>
        </div>
      </div>
      {caption && <figcaption id={captionId}>{caption}</figcaption>}
      <dialog
        ref={previewRef}
        className={styles.preview}
        tabIndex={-1}
        data-image-gallery-zoom-rect={previewZoomRect?.direction} // `image-gallery.module.css` hides the frame while the zoom rect runs.
        aria-label="Image preview"
        data-content-default-styles="off"
        data-feed-omit
        onPointerDown={(event) => {
          isPressOutsidePreviewRef.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          // Close the preview only when a press begins and ends outside the frame. A click alone can
          // target the dialog when a press starts on the image and ends outside the frame.
          if (event.target === event.currentTarget && isPressOutsidePreviewRef.current) {
            closePreview();
          }
        }}
        onCancel={(event) => {
          event.preventDefault(); // The Escape key closes the preview through its zoom rect.
          closePreview();
        }}
        onClose={() => {
          // Restore focus to the active preview image's thumbnail, which is the row's tab stop.
          if (thumbnailListRef.current?.contains(document.activeElement)) {
            focusThumbnail(currentIndex);
          }
        }}
      >
        <div ref={previewFrameRef} className={styles.previewFrame}>
          <div className={styles.previewTitleBar}>
            <button
              type="button"
              className={styles.previewCloseButton}
              disabled={!hasControls}
              aria-label="Close preview"
              aria-keyshortcuts="Space"
              {...closeButtonPressSoundHandlers}
              onClick={(event) => {
                closeButtonPressSoundHandlers.onClick(event);
                closePreview();
              }}
            />
          </div>
          <div
            ref={previewImageRef}
            className={styles.previewImage}
            aria-live="polite"
            {...mergeHandlers(previewSwipeHandlers, previewImageHandlers)}
          >
            <div
              key={currentIndex}
              role="group"
              aria-roledescription="slide"
              aria-label={positionLabelOf(currentIndex)}
            >
              {images[currentIndex]}
            </div>
          </div>
          <div className={cx(styles.controls, styles.previewControls)}>
            {previousControl}
            <span className={styles.position} aria-hidden>
              {positionLabelOf(currentIndex)}
            </span>
            {nextControl}
          </div>
        </div>
        {previewZoomRect && (
          <ZoomRect
            key={previewZoomRect.direction}
            from={previewZoomRect.from}
            target={previewZoomRect.to}
            onDone={() => finishZoomRect(previewZoomRect.direction)}
          />
        )}
      </dialog>
    </figure>
  );
}
