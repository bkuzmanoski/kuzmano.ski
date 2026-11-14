import type { NonEmptyReadonlyArray } from "#/lib/arrays.ts";
import type { ConvexPolygon } from "#/lib/convex-polygon.ts";
import type { Size } from "#/lib/geometry.ts";
import { randomElementOf, randomIntegerBelow } from "#/lib/random.ts";
import type { FlightProfile, FlightSettings } from "#/lib/screensaver/flight.ts";

export const SPRITE_SIZE_PX = 64;
export const SPRITE_AREA_PX2 = SPRITE_SIZE_PX ** 2;

/**
 * Exponent applied to the viewport area, measured in `SPRITE_AREA_PX2` units, to determine the sprite count. Values
 * below `1` increase sprite density on smaller viewports.
 */
export const SPRITE_COUNT_AREA_EXPONENT = 0.5;

export const FLIGHT_SETTINGS: FlightSettings = {
  spriteSizePx: SPRITE_SIZE_PX,
  descentPerPx: 0.4,
  clearancePx: 8,
  placementAttempts: 16,
};

export const TOASTER_FLAP_FRAME_COUNT = 4;
export const TOASTER_FLAP_MS = 180;
export const TOASTER_SPEEDS_PX_PER_S: NonEmptyReadonlyArray<number> = [90, 120, 180];
export const TOASTERS_PER_TOAST = 3;

/** Toast flies at the slowest toaster's speed as it does not give way. */
export const TOAST_SPEED_PX_PER_S = Math.min(...TOASTER_SPEEDS_PX_PER_S);

// Convex outlines enclosing the toaster (across every wingbeat frame) and toast sprites. They approximate the opaque
// pixels with a few vertices instead of tracing each pixel corner.
export const TOASTER_OUTLINE: ConvexPolygon = [
  { x: 1, y: 24 },
  { x: 9, y: 8 },
  { x: 19, y: -2 },
  { x: 64, y: 15 },
  { x: 64, y: 52 },
  { x: 56, y: 65 },
  { x: 8, y: 59 },
  { x: 1, y: 52 },
];
export const TOAST_OUTLINE: ConvexPolygon = [
  { x: 8, y: 24 },
  { x: 32, y: 15 },
  { x: 37, y: 15 },
  { x: 59, y: 28 },
  { x: 59, y: 40 },
  { x: 32, y: 53 },
  { x: 16, y: 45 },
  { x: 8, y: 37 },
];

const TOAST_IMAGES = ["toast-1", "toast-2", "toast-3"] as const;

type ToastImage = (typeof TOAST_IMAGES)[number];

export type SpriteImage = "toaster" | ToastImage;
export type Sprite = FlightProfile &
  (
    | {
        image: "toaster";
        /** The frame at which the toaster's wingbeat starts, so the toasters flap out of step. */
        flapPhase: number;
      }
    | { image: ToastImage }
  );

/** Returns the sprites for a screen of `viewport`'s size. */
export function flockFor({ width, height }: Size, random: () => number): Array<Sprite> {
  const areaRatio = (width * height) / SPRITE_AREA_PX2;
  const spriteCount = Math.max(1, Math.round(areaRatio ** SPRITE_COUNT_AREA_EXPONENT));
  const toastCount = Math.round(spriteCount / (TOASTERS_PER_TOAST + 1));
  const toasterCount = spriteCount - toastCount;
  const toastImage = randomElementOf(TOAST_IMAGES, random); // Pick a random doneness per flock.

  return [
    ...Array.from({ length: toasterCount }, (): Sprite => ({
      image: "toaster",
      outline: TOASTER_OUTLINE,
      speedsPxPerS: TOASTER_SPEEDS_PX_PER_S,
      givesWay: true,
      flapPhase: randomIntegerBelow(TOASTER_FLAP_FRAME_COUNT, random),
    })),
    ...Array.from({ length: toastCount }, (): Sprite => ({
      image: toastImage,
      outline: TOAST_OUTLINE,
      speedsPxPerS: [TOAST_SPEED_PX_PER_S],
      givesWay: false,
    })),
  ];
}

/** Returns the frame of a toaster's wingbeat at `timeMs`, starting `flapPhase` frames in. */
export function toasterFlapFrameAt(timeMs: number, flapPhase: number): number {
  const strokes = timeMs / TOASTER_FLAP_MS + flapPhase / TOASTER_FLAP_FRAME_COUNT;
  const stroke = Math.floor(strokes);
  const frame = Math.floor((strokes - stroke) * TOASTER_FLAP_FRAME_COUNT);

  return stroke % 2 === 0 ? frame : TOASTER_FLAP_FRAME_COUNT - 1 - frame;
}
