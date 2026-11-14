import toast1ImageUrl from "#/assets/images/screensaver-toast-1.gif?url";
import toast2ImageUrl from "#/assets/images/screensaver-toast-2.gif?url";
import toast3ImageUrl from "#/assets/images/screensaver-toast-3.gif?url";
import toasterImageUrl from "#/assets/images/screensaver-toaster-sprite.gif?url";
import { loopAnimationFrames } from "#/lib/animation-frames.ts";
import { viewportSize } from "#/lib/geometry.ts";
import { createFlight } from "#/lib/screensaver/flight.ts";
import type { Flight } from "#/lib/screensaver/flight.ts";

import { FLIGHT_SETTINGS, SPRITE_SIZE_PX, flockFor, toasterFlapFrameAt } from "./flock.ts";

import type { Sprite, SpriteImage } from "./flock.ts";

/**
 * Maximum time the flight advances per frame, preventing jumps after animation frames pause (e.g., in a hidden tab).
 */
export const MAX_STEP_S = 0.1;

/** Returns a flight of a flock for the viewport, with the sprites' entries staggered. */
export function createFlockFlight(): Flight<Sprite> {
  const viewport = viewportSize();
  const flight = createFlight({
    profiles: flockFor(viewport, Math.random),
    viewport,
    settings: FLIGHT_SETTINGS,
    random: Math.random,
  });

  flight.stagger();

  return flight;
}

const SPRITE_IMAGE_URLS: Record<SpriteImage, string> = {
  toaster: toasterImageUrl,
  "toast-1": toast1ImageUrl,
  "toast-2": toast2ImageUrl,
  "toast-3": toast3ImageUrl,
};

let spriteImages: Record<SpriteImage, HTMLImageElement> | null = null;

function loadSpriteImages() {
  spriteImages ??= Object.fromEntries(
    Object.entries(SPRITE_IMAGE_URLS).map(([image, url]) => [image, Object.assign(new Image(), { src: url })]),
  ) as Record<SpriteImage, HTMLImageElement>;
  return spriteImages;
}

/** Animates and renders the flock on `canvas` at whole device pixels, returning a function that stops the animation. */
export function startFlockAnimation(flight: Flight<Sprite>, canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");

  if (!context) {
    return () => undefined;
  }

  const images = loadSpriteImages();

  let previousFrameAt: number | null = null;

  return loopAnimationFrames((now) => {
    const viewport = viewportSize();
    const pixelRatio = window.devicePixelRatio;
    const width = Math.round(viewport.width * pixelRatio);
    const height = Math.round(viewport.height * pixelRatio);

    if (canvas.width !== width || canvas.height !== height) {
      // Match the CSS size to the device-pixel dimensions to prevent browser scaling.
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width / pixelRatio}px`;
      canvas.style.height = `${height / pixelRatio}px`;
    }

    flight.resize(viewport);
    flight.step(previousFrameAt === null ? 0 : Math.min((now - previousFrameAt) / 1000, MAX_STEP_S));

    previousFrameAt = now;

    const sizePx = Math.round(SPRITE_SIZE_PX * pixelRatio);

    context.imageSmoothingEnabled = false; // Resizing the canvas resets it.
    context.clearRect(0, 0, width, height);

    for (const sprite of flight.sprites) {
      if (!sprite.isFlying) {
        continue;
      }

      const image = images[sprite.image];

      if (!image.complete || image.naturalWidth === 0) {
        continue; // Omit a sprite until its image loads.
      }

      const frame = sprite.image === "toaster" ? toasterFlapFrameAt(now, sprite.flapPhase) : 0;

      context.drawImage(
        image,
        frame * SPRITE_SIZE_PX,
        0,
        SPRITE_SIZE_PX,
        SPRITE_SIZE_PX,
        Math.round(sprite.x * pixelRatio),
        Math.round(sprite.y * pixelRatio),
        sizePx,
        sizePx,
      );
    }
  });
}
