import { beforeEach, describe, expect, test, vi } from "vitest";

import { viewportSize } from "#/lib/geometry.ts";
import { createSeededRandom } from "#/lib/random.ts";
import { createFlight } from "#/lib/screensaver/flight.ts";
import { stubCanvasContext, stubImageLoad } from "#/test-utils/canvas.ts";

import { MAX_STEP_S, startFlockAnimation } from "./flock-animation.ts";
import { FLIGHT_SETTINGS, SPRITE_SIZE_PX, TOASTER_SPEEDS_PX_PER_S, TOAST_SPEED_PX_PER_S } from "./flock.ts";

import type { Sprite } from "./flock.ts";

let context: ReturnType<typeof stubCanvasContext>;
let pendingFrame: FrameRequestCallback | null = null;
let nowMs = 0;

beforeEach(() => {
  context = stubCanvasContext();
  stubImageLoad("loaded");
  pendingFrame = null;
  nowMs = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingFrame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pendingFrame = null;
  });
});

const FRAME_MS = 16;
const OUTLINE = [
  { x: 0, y: 0 },
  { x: SPRITE_SIZE_PX, y: 0 },
  { x: SPRITE_SIZE_PX, y: SPRITE_SIZE_PX },
  { x: 0, y: SPRITE_SIZE_PX },
];
const TOASTER: Sprite = {
  image: "toaster",
  outline: OUTLINE,
  speedsPxPerS: TOASTER_SPEEDS_PX_PER_S,
  givesWay: true,
  flapPhase: 0,
};
const TOAST: Sprite = { image: "toast-1", outline: OUTLINE, speedsPxPerS: [TOAST_SPEED_PX_PER_S], givesWay: false };

const flightOf = (sprites: ReadonlyArray<Sprite>, random: () => number = () => 0.5) =>
  createFlight({ profiles: sprites, viewport: viewportSize(), settings: FLIGHT_SETTINGS, random });
const animate = (flight: ReturnType<typeof flightOf>) => startFlockAnimation(flight, document.createElement("canvas"));

/** Runs the pending animation frame `elapsedMs` after the previous one. */
function runFrameAfter(elapsedMs: number) {
  const callback = pendingFrame;

  if (!callback) {
    throw new Error("The animation did not request a frame.");
  }

  pendingFrame = null;
  nowMs += elapsedMs;
  callback(nowMs);
}

function runFramesFor(durationMs: number) {
  for (let elapsedMs = 0; elapsedMs < durationMs; elapsedMs += FRAME_MS) {
    runFrameAfter(FRAME_MS);
  }
}

describe("startFlockAnimation", () => {
  test("sizes the canvas to the viewport in whole device pixels, with a CSS size that spans exactly those pixels", () => {
    const pixelRatio = 1.5;
    const canvas = document.createElement("canvas");

    vi.stubGlobal("innerWidth", 801);
    vi.stubGlobal("devicePixelRatio", pixelRatio);
    startFlockAnimation(flightOf([TOAST]), canvas);
    runFrameAfter(0);

    expect(canvas.width).toBe(Math.round(801 * pixelRatio));
    expect(Number.parseFloat(canvas.style.width) * pixelRatio).toBeCloseTo(canvas.width);
  });

  test("resizes the canvas and the flight to the viewport on the first frame after it resizes", () => {
    const canvas = document.createElement("canvas");
    const flight = flightOf([TOAST]);
    const resize = vi.spyOn(flight, "resize");

    startFlockAnimation(flight, canvas);
    runFrameAfter(0);
    vi.stubGlobal("innerWidth", 640);
    runFrameAfter(FRAME_MS);

    expect(canvas.width).toBe(640);
    expect(resize).toHaveBeenLastCalledWith({ width: 640, height: window.innerHeight });
  });

  test("steps the flight by `0` on the first frame, then by the time since the previous frame, up to `MAX_STEP_S`", () => {
    const flight = flightOf([TOAST]);
    const step = vi.spyOn(flight, "step");

    animate(flight);
    runFrameAfter(0);
    runFrameAfter(FRAME_MS);
    runFrameAfter(10_000); // Simulates the first frame after returning from a hidden tab.

    expect(step.mock.calls.map(([elapsedS]) => elapsedS)).toEqual([0, FRAME_MS / 1000, MAX_STEP_S]);
  });

  test("renders each sprite at a position and size in whole device pixels", () => {
    const pixelRatio = 1.5;

    vi.stubGlobal("devicePixelRatio", pixelRatio);
    animate(
      flightOf(
        Array.from({ length: 4 }, () => TOASTER),
        createSeededRandom(1),
      ),
    );
    runFramesFor(2000);

    const destinations = context.drawImage.mock.calls.map((call) => call.slice(5) as Array<number>);

    expect(destinations).not.toHaveLength(0);
    expect(destinations.flat().every(Number.isInteger)).toBe(true);
    expect(new Set(destinations.flatMap(([, , width, height]) => [width, height]))).toEqual(
      new Set([SPRITE_SIZE_PX * pixelRatio]),
    );
  });

  test("omits a sprite whose image failed to load, then renders it on the next frame after its image loads", () => {
    stubImageLoad("failed");
    animate(flightOf([TOAST]));
    runFramesFor(100);

    expect(context.drawImage).not.toHaveBeenCalled();

    stubImageLoad("loaded");
    runFrameAfter(FRAME_MS);

    expect(context.drawImage).toHaveBeenCalledTimes(1);
  });
});
