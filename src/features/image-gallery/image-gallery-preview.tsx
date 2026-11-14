import { useImperativeHandle, useRef, useState } from "react";

import { Tooltip } from "#/components/tooltip.tsx";
import { ZoomRect } from "#/features/window-manager/zoom-rect.tsx";
import { cx } from "#/lib/class-names.ts";
import { rectRelativeTo } from "#/lib/geometry.ts";
import type { Rect } from "#/lib/geometry.ts";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";

import { usePreviewImageLayout } from "./image-gallery-preview-layout.ts";
import styles from "./image-gallery-preview.module.css";
import { useImageGallerySwipe } from "./image-gallery-swipe.ts";
import galleryStyles from "./image-gallery.module.css";

import type { ReactElement, ReactNode, Ref, RefObject } from "react";

interface PreviewZoomRect {
  direction: "in" | "out";
  from: Rect;
  to: Rect;
}

export interface ImageGalleryPreviewHandle {
  open: () => void;
  toggle: () => void;
}

export function ImageGalleryPreview({
  ref,
  stageRef,
  currentIndex,
  image,
  positionLabel,
  previousControl,
  nextControl,
  hasControls,
  onSwipe,
  onClose,
}: {
  ref: Ref<ImageGalleryPreviewHandle>;
  stageRef: RefObject<HTMLElement | null>;
  currentIndex: number;
  image: ReactElement | undefined;
  positionLabel: string;
  previousControl: ReactNode;
  nextControl: ReactNode;
  hasControls: boolean;
  onSwipe: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const [zoomRect, setZoomRect] = useState<PreviewZoomRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonPressSoundHandlers = usePressSound();
  const previewRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLDivElement>(null);
  const isPressOutsideRef = useRef(false);

  const { fitPreviewImage, isSwipeEnabled, previewImageHandlers } = usePreviewImageLayout(
    previewRef,
    previewImageRef,
    currentIndex,
    isOpen,
  );
  const swipeHandlers = useImageGallerySwipe((direction) => {
    if (isSwipeEnabled()) {
      onSwipe(direction);
    }
  });

  function finishZoomRect(direction: PreviewZoomRect["direction"]) {
    setZoomRect(null);

    if (direction === "out") {
      previewRef.current?.close();
    }
  }

  function startZoomRect(direction: PreviewZoomRect["direction"]) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const frameRect = frameRef.current?.getBoundingClientRect();

    if (!stageRect || !frameRect || getPrefersReducedMotion()) {
      finishZoomRect(direction);
      return;
    }

    const stage = rectRelativeTo(stageRect, frameRect);
    const frame = { x: 0, y: 0, width: frameRect.width, height: frameRect.height };

    setZoomRect(direction === "in" ? { direction, from: stage, to: frame } : { direction, from: frame, to: stage });
  }

  function open() {
    const preview = previewRef.current;

    if (!preview || preview.open) {
      return;
    }

    preview.showModal();
    setIsOpen(true);
    preview.focus(); // Keep focus on the preview so Space does not advance the gallery.
    fitPreviewImage({ resetsZoom: true });
    startZoomRect("in");
  }

  function close() {
    // A preview that is already closing keeps closing instead of starting its zoom rect again.
    if (previewRef.current?.open && zoomRect?.direction !== "out") {
      startZoomRect("out");
    }
  }

  useImperativeHandle(ref, () => ({
    open,
    toggle: () => (previewRef.current?.open ? close() : open()),
  }));

  return (
    <dialog
      ref={previewRef}
      className={styles.preview}
      tabIndex={-1}
      data-image-gallery-zoom-rect={zoomRect?.direction} // Styles hide the frame while the zoom rect runs.
      aria-label="Image preview"
      data-content-default-styles="off"
      data-feed-omit
      onPointerDown={(event) => {
        isPressOutsideRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Close the preview only when a press begins and ends outside the frame. A click alone can target the dialog
        // when a press starts on the image and ends outside the frame.
        if (event.target === event.currentTarget && isPressOutsideRef.current) {
          close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault(); // The Escape key closes the preview through its zoom rect.
        close();
      }}
      onClose={() => {
        setIsOpen(false);
        onClose();
      }}
    >
      <div ref={frameRef} className={styles.previewFrame}>
        <div className={styles.previewTitleBar}>
          <Tooltip label="Close preview" suppressed={!hasControls}>
            <button
              type="button"
              className={styles.previewCloseButton}
              disabled={!hasControls}
              aria-label="Close preview"
              aria-keyshortcuts="Space"
              {...closeButtonPressSoundHandlers}
              onClick={(event) => {
                closeButtonPressSoundHandlers.onClick(event);
                close();
              }}
            />
          </Tooltip>
        </div>
        <div
          ref={previewImageRef}
          className={styles.previewImage}
          aria-live="polite"
          {...mergeHandlers(swipeHandlers, previewImageHandlers)}
        >
          <div key={currentIndex} role="group" aria-roledescription="slide" aria-label={positionLabel}>
            {image}
          </div>
        </div>
        {/* The gallery's `.controls > .control` rules style the previous and next controls that `ImageGallery` passes in. */}
        <div className={cx(galleryStyles.controls, styles.previewControls)}>
          {previousControl}
          <span className={styles.position} aria-hidden>
            {positionLabel}
          </span>
          {nextControl}
        </div>
      </div>
      {zoomRect && (
        <ZoomRect
          key={zoomRect.direction}
          from={zoomRect.from}
          target={zoomRect.to}
          onDone={() => finishZoomRect(zoomRect.direction)}
        />
      )}
    </dialog>
  );
}
