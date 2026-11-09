import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";

import PreviewImageGalleryIcon from "#/assets/images/image-gallery-icon-preview.svg?react";
import ArrowScrollbarIcon from "#/assets/images/scrollbar-icon-arrow.svg?react";
import { IconButton } from "#/components/icon-button.tsx";
import { playKeyPressSounds } from "#/lib/audio/key-press-sounds.ts";
import { loadKeySounds, playHoverSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { clamp } from "#/lib/math.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";

import { ImageGalleryPreview } from "./image-gallery-preview.tsx";
import { useImageGallerySwipe } from "./image-gallery-swipe.ts";
import styles from "./image-gallery.module.css";

import type { ImageGalleryPreviewHandle } from "./image-gallery-preview.tsx";
import type { ComponentPropsWithoutRef, KeyboardEvent, ReactElement, ReactNode } from "react";

function imagesIn(children: ReactNode): Array<ReactElement> {
  return Children.toArray(children).flatMap((child) => {
    if (typeof child === "string" && child.trim() === "") {
      return []; // The line breaks between images authored on consecutive lines.
    }

    // The build removes the paragraphs around images authored in Markdown (see
    // `/build/content/markup/inline-content.ts`).
    if (isValidElement(child) && (child.type === "img" || child.type === "picture")) {
      return [child];
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

/** Scrolls only the thumbnail row; `scrollIntoView` would also scroll the page, potentially behind an open preview. */
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

export function ImageGallery({
  caption,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"figure">, "children" | "onKeyDown"> & { caption?: string; children: ReactNode }) {
  const idPrefix = useId();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFocusInThumbnails, setIsFocusInThumbnails] = useState(false);
  const images = galleryImagesIn(children);
  const hasControls = useIsHydrated();
  const stagePressSoundHandlers = usePressSound({ defersTouchPressSound: true });
  const thumbnailPressSoundHandlers = usePressSound({ defersTouchPressSound: true });
  const galleryRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbnailListRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ImageGalleryPreviewHandle>(null);

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
        previewRef.current?.toggle();
      }
    }
  }

  function onSwipe(direction: 1 | -1) {
    if (canStep && step(direction) !== null) {
      playHoverSound();
    }
  }

  const stageSwipeHandlers = useImageGallerySwipe(onSwipe);

  const previousControl = (
    <IconButton
      variant="strip"
      label="Previous image"
      disabled={!canStep}
      aria-disabled={(canStep && isFirstImage) || undefined} // Marked `aria-disabled` rather than disabled so the focus remains on it.
      aria-keyshortcuts="ArrowLeft"
      className={cx(styles.control, styles.previousControl)}
      onClick={() => step(-1)}
    >
      <ArrowScrollbarIcon className={styles.previousIcon} />
    </IconButton>
  );
  const nextControl = (
    <IconButton
      variant="strip"
      label="Next image"
      disabled={!canStep}
      aria-disabled={(canStep && isLastImage) || undefined} // Marked `aria-disabled` rather than disabled so the focus remains on it.
      aria-keyshortcuts="ArrowRight"
      className={cx(styles.control, styles.nextControl)}
      onClick={() => step(1)}
    >
      <ArrowScrollbarIcon className={styles.nextIcon} />
    </IconButton>
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

          // Safari does not focus pressed buttons, and presses around thumbnails do not focus anything. Focus the
          // pressed button or the gallery so arrow keys remain available. Slides retain focus after being pressed
          // because they are focusable.
          (button && !button.disabled ? button : galleryRef.current)?.focus({ preventScroll: true });
        }}
      >
        <div
          ref={stageRef}
          className={styles.stage}
          aria-live={isFocusInThumbnails ? "off" : "polite"} // A screen reader announces the focused thumbnail, which names the image it selects, so the stage stays silent instead of announcing the image again.
          {...mergeHandlers(stageSwipeHandlers, stagePressSoundHandlers)}
          onClick={(event) => {
            if (hasControls) {
              stagePressSoundHandlers.onClick(event);
              previewRef.current?.open();
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
              aria-keyshortcuts="Space"
              hidden={index !== currentIndex}
            >
              {image}
            </div>
          ))}
        </div>
        <div className={styles.controls} data-feed-omit>
          {previousControl}
          <div className={styles.thumbnailRow}>
            <div
              ref={thumbnailListRef}
              className={styles.thumbnails}
              role="tablist"
              aria-label="Images"
              onFocus={() => setIsFocusInThumbnails(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsFocusInThumbnails(false);
                }
              }}
            >
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
                  aria-keyshortcuts="Space"
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
          <IconButton
            variant="strip"
            label="Preview image"
            disabled={!hasControls}
            aria-keyshortcuts="Space"
            className={cx(styles.control, styles.previewControl)}
            onClick={() => previewRef.current?.open()}
          >
            <PreviewImageGalleryIcon />
          </IconButton>
        </div>
      </div>
      {caption && <figcaption id={captionId}>{caption}</figcaption>}
      <ImageGalleryPreview
        ref={previewRef}
        stageRef={stageRef}
        currentIndex={currentIndex}
        image={images[currentIndex]}
        positionLabel={positionLabelOf(currentIndex)}
        previousControl={previousControl}
        nextControl={nextControl}
        hasControls={hasControls}
        onSwipe={onSwipe}
        onClose={() => {
          // Restore focus to the active preview image's thumbnail, which is the row's tab stop.
          if (thumbnailListRef.current?.contains(document.activeElement)) {
            focusThumbnail(currentIndex);
          }
        }}
      />
    </figure>
  );
}
