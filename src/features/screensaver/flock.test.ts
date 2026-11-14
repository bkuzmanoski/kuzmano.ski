import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { convexHullOf, depthOf, halfPlanesOf } from "#/lib/convex-polygon.ts";
import type { ConvexPolygon } from "#/lib/convex-polygon.ts";
import { createSeededRandom } from "#/lib/random.ts";

import {
  SPRITE_AREA_PX2,
  SPRITE_COUNT_AREA_EXPONENT,
  SPRITE_SIZE_PX,
  TOASTERS_PER_TOAST,
  TOASTER_FLAP_FRAME_COUNT,
  TOASTER_FLAP_MS,
  TOASTER_OUTLINE,
  TOAST_OUTLINE,
  flockFor,
  toasterFlapFrameAt,
} from "./flock.ts";

const FLAP_FRAME_MS = TOASTER_FLAP_MS / TOASTER_FLAP_FRAME_COUNT;
const FLAP_FRAMES = Array.from({ length: TOASTER_FLAP_FRAME_COUNT }, (_, frame) => frame);
const VIEWPORT = { width: 1470, height: 956 };

function viewportWithAreaRatio(areaRatio: number) {
  const height = Math.sqrt((areaRatio * SPRITE_AREA_PX2) / 2);
  return { width: height * 2, height };
}

const viewportWithSpriteCount = (spriteCount: number) =>
  viewportWithAreaRatio(spriteCount ** (1 / SPRITE_COUNT_AREA_EXPONENT));

async function opaquePixelCornersOf(fileName: string) {
  const { data, info } = await sharp(`${process.cwd()}/src/assets/images/${fileName}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners: Array<{ x: number; y: number }> = [];

  for (let imageX = 0; imageX < info.width; imageX++) {
    for (let y = 0; y < info.height; y++) {
      if (data[(y * info.width + imageX) * 4 + 3]! > 0) {
        const x = imageX % SPRITE_SIZE_PX;
        corners.push({ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 });
      }
    }
  }

  return corners;
}

const countsOf = (sprites: ReturnType<typeof flockFor>) => ({
  toasters: sprites.filter(({ image }) => image === "toaster").length,
  toast: sprites.filter(({ image }) => image !== "toaster").length,
});

/** Returns the frame of each frame-long interval across `strokeCount` strokes, sampled at the middle of each. */
const flapFramesOver = (strokeCount: number, flapPhase: number) =>
  Array.from({ length: strokeCount * TOASTER_FLAP_FRAME_COUNT }, (_, index) =>
    toasterFlapFrameAt((index + 0.5) * FLAP_FRAME_MS, flapPhase),
  );

describe("flockFor", () => {
  test("returns `TOASTERS_PER_TOAST` toasters for each piece of toast", () => {
    const { toasters, toast } = countsOf(flockFor(viewportWithSpriteCount(3 * (TOASTERS_PER_TOAST + 1)), Math.random));

    expect(toast).toBe(3);
    expect(toasters).toBe(toast * TOASTERS_PER_TOAST);
  });

  test("returns the viewport's area, in multiples of `SPRITE_AREA_PX2`, to the power of `SPRITE_COUNT_AREA_EXPONENT` sprites", () => {
    expect(flockFor(viewportWithAreaRatio(1), Math.random)).toHaveLength(1);
    expect(flockFor(viewportWithAreaRatio(400), Math.random)).toHaveLength(
      Math.round(400 ** SPRITE_COUNT_AREA_EXPONENT),
    );
  });

  test("returns as many sprites for a portrait viewport as for the landscape viewport of the same size", () => {
    const { width, height } = VIEWPORT;

    expect(flockFor({ width: height, height: width }, Math.random)).toHaveLength(
      flockFor(VIEWPORT, Math.random).length,
    );
  });

  test("returns one toaster for a viewport too small for the sprite count to round up to `1`", () => {
    expect(countsOf(flockFor({ width: 10, height: 10 }, Math.random))).toEqual({ toasters: 1, toast: 0 });
  });

  test("returns toasters that give way and toast that does not", () => {
    const sprites = flockFor(VIEWPORT, createSeededRandom(1));
    const toasters = sprites.filter(({ image }) => image === "toaster");
    const toast = sprites.filter(({ image }) => image !== "toaster");

    expect(toasters.every(({ givesWay }) => givesWay)).toBe(true);
    expect(toast.every(({ givesWay }) => !givesWay)).toBe(true);
  });

  test("returns toast that flies no faster than the slowest toaster", () => {
    const sprites = flockFor(VIEWPORT, createSeededRandom(1));
    const toasters = sprites.filter(({ image }) => image === "toaster");
    const toast = sprites.filter(({ image }) => image !== "toaster");

    // Toast does not give way, so a piece faster than a toaster ahead would fly behind it at the toaster's speed.
    expect(Math.max(...toast.flatMap(({ speedsPxPerS }) => speedsPxPerS))).toBeLessThanOrEqual(
      Math.min(...toasters.flatMap(({ speedsPxPerS }) => speedsPxPerS)),
    );
  });

  test("returns all of the toast at one doneness", () => {
    const toastImages = new Set(
      flockFor(VIEWPORT, createSeededRandom(1))
        .filter(({ image }) => image !== "toaster")
        .map(({ image }) => image),
    );
    expect(toastImages.size).toBe(1);
  });
});

describe("toasterFlapFrameAt", () => {
  test("steps forward through the frames on one stroke and back through them on the next", () => {
    expect(flapFramesOver(2, 0)).toEqual([...FLAP_FRAMES, ...[...FLAP_FRAMES].reverse()]);
  });

  test("starts the wingbeat `flapPhase` frames in", () => {
    expect(FLAP_FRAMES.map((flapPhase) => flapFramesOver(1, flapPhase)[0])).toEqual(FLAP_FRAMES);
  });
});

describe.each<[string, ConvexPolygon]>([
  ["screensaver-toaster-sprite.gif", TOASTER_OUTLINE],
  ["screensaver-toast-1.gif", TOAST_OUTLINE],
  ["screensaver-toast-2.gif", TOAST_OUTLINE],
  ["screensaver-toast-3.gif", TOAST_OUTLINE],
])("the sprite outline of `%s`", (fileName, outline) => {
  test("contains every opaque pixel in every frame", async () => {
    const corners = await opaquePixelCornersOf(fileName);
    const halfPlanes = halfPlanesOf(convexHullOf(outline));
    const outsideCorners = corners.filter((corner) => depthOf(halfPlanes, corner) < -1e-9);

    expect(corners).not.toHaveLength(0);
    expect(outsideCorners).toEqual([]);
  });
});
