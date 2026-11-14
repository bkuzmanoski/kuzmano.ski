import { beforeAll, describe, expect, test } from "vitest";

import { createSeededRandom } from "../random.ts";

import { createFlight } from "./flight.ts";

import type { ConvexPolygon } from "../convex-polygon.ts";
import type { Position, Size } from "../geometry.ts";
import type { Flight, FlightProfile, FlightSettings, FlightSprite } from "./flight.ts";

const STEP_S = 0.1;
const SLOW_SPEED_PX_PER_S = 20;
const FAST_SPEED_PX_PER_S = 60;
const BOX_BOUNDS = { left: 8, top: 16, right: 56, bottom: 48 };
const BOX_OUTLINE: ConvexPolygon = [
  { x: BOX_BOUNDS.left, y: BOX_BOUNDS.top },
  { x: BOX_BOUNDS.right, y: BOX_BOUNDS.top },
  { x: BOX_BOUNDS.right, y: BOX_BOUNDS.bottom },
  { x: BOX_BOUNDS.left, y: BOX_BOUNDS.bottom },
];
const DIAMOND_OUTLINE: ConvexPolygon = [
  { x: 32, y: 0 },
  { x: 64, y: 32 },
  { x: 32, y: 64 },
  { x: 0, y: 32 },
];
const VIEWPORT: Size = { width: 640, height: 480 };
const FLIGHT_SETTINGS: FlightSettings = {
  spriteSizePx: 64,
  descentPerPx: 0.4,
  clearancePx: 4,
  placementAttempts: 8,
};
const SLOW_FLIGHT_PROFILE: FlightProfile = {
  outline: BOX_OUTLINE,
  speedsPxPerS: [SLOW_SPEED_PX_PER_S],
  givesWay: true,
};
const FAST_FLIGHT_PROFILE: FlightProfile = {
  outline: BOX_OUTLINE,
  speedsPxPerS: [FAST_SPEED_PX_PER_S],
  givesWay: true,
};
const MIXED_FLIGHT_PROFILE: FlightProfile = {
  outline: BOX_OUTLINE,
  speedsPxPerS: [SLOW_SPEED_PX_PER_S, FAST_SPEED_PX_PER_S],
  givesWay: true,
};
const RIGHT_EDGE_ENTRY: Position = { x: VIEWPORT.width, y: 100 };

/** The horizontal distance between two sprites with `BOX_OUTLINE` on one lane, `clearancePx` apart. */
const CONTACT_SPACING_PX = BOX_BOUNDS.right - BOX_BOUNDS.left + FLIGHT_SETTINGS.clearancePx;

/** The vertical distance between two sprites with `BOX_OUTLINE`, one directly above the other, `clearancePx` apart. */
const STACK_SPACING_PX = BOX_BOUNDS.bottom - BOX_BOUNDS.top + FLIGHT_SETTINGS.clearancePx;

const laneOf = ({ x, y }: Position) => y + FLIGHT_SETTINGS.descentPerPx * x;
const positionOnLane = (lane: number, x: number): Position => ({ x, y: lane - FLIGHT_SETTINGS.descentPerPx * x });

const withoutGivingWay = (profile: FlightProfile): FlightProfile => ({ ...profile, givesWay: false });

/** Returns each supplied value in order, then repeats the last value indefinitely. */
function randomReturning(...values: Array<number>) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

/**
 * Returns the random value that places a sprite at `position` when it enters from the right or top edge, as a flight
 * chooses uniformly among the lanes that cross the viewport.
 */
function laneRandomAt(position: Position, { width, height }: Size = VIEWPORT) {
  const { spriteSizePx, descentPerPx } = FLIGHT_SETTINGS;
  const lowestOffsetPx = -spriteSizePx * (1 + descentPerPx);
  const highestOffsetPx = height + descentPerPx * width;

  return (laneOf(position) - lowestOffsetPx) / (highestOffsetPx - lowestOffsetPx);
}

const flightOf = (profiles: ReadonlyArray<FlightProfile>, random: () => number, viewport = VIEWPORT) =>
  createFlight({ profiles, viewport, settings: FLIGHT_SETTINGS, random });

/** Places `sprite` in flight at `position` and `speedPxPerS`, without entering it. */
function placeInFlight(sprite: Readonly<FlightSprite>, position: Position, speedPxPerS: number) {
  Object.assign(sprite, { isFlying: true, ...position, speedPxPerS });
}

function stepTimes(flight: Flight, steps: number) {
  for (let step = 0; step < steps; step++) {
    flight.step(STEP_S);
  }
}

/** Advances `flight` until `isDone` is true, throwing after `maxSteps` steps. */
function stepUntil(flight: Flight, isDone: () => boolean, maxSteps = 1000) {
  for (let step = 0; !isDone(); step++) {
    if (step === maxSteps) {
      throw new Error(`The flight did not reach the expected state within ${maxSteps} steps.`);
    }

    flight.step(STEP_S);
  }
}

// The tests measure outlines without `convex-polygon.ts`, so a defect there cannot hide a collision.
const placedOutlineOf = ({ outline, x, y }: FlightSprite) =>
  outline.map((vertex) => ({ x: vertex.x + x, y: vertex.y + y }));
const edgesOf = (polygon: ConvexPolygon) =>
  polygon.map((start, index) => [start, polygon[(index + 1) % polygon.length]!] as const);
const crossProductOf = (origin: Position, a: Position, b: Position) =>
  (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
const isInside = (polygon: ConvexPolygon, point: Position) =>
  edgesOf(polygon).every(([start, end]) => crossProductOf(start, end, point) > 0);

function distanceToSegment(point: Position, [start, end]: readonly [Position, Position]) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared),
  );

  return Math.hypot(point.x - start.x - t * (end.x - start.x), point.y - start.y - t * (end.y - start.y));
}

/** Returns the distance between two sprites' outlines, or `0` where they intersect. */
function gapBetween(a: FlightSprite, b: FlightSprite) {
  const aOutline = placedOutlineOf(a);
  const bOutline = placedOutlineOf(b);
  const edgesCross = edgesOf(aOutline).some(([aStart, aEnd]) =>
    edgesOf(bOutline).some(
      ([bStart, bEnd]) =>
        crossProductOf(aStart, aEnd, bStart) * crossProductOf(aStart, aEnd, bEnd) < 0 &&
        crossProductOf(bStart, bEnd, aStart) * crossProductOf(bStart, bEnd, aEnd) < 0,
    ),
  );

  if (
    edgesCross ||
    aOutline.some((point) => isInside(bOutline, point)) ||
    bOutline.some((point) => isInside(aOutline, point))
  ) {
    return 0;
  }

  return Math.min(
    ...aOutline.flatMap((point) => edgesOf(bOutline).map((edge) => distanceToSegment(point, edge))),
    ...bOutline.flatMap((point) => edgesOf(aOutline).map((edge) => distanceToSegment(point, edge))),
  );
}

/** Whether the gap between the outlines of two sprites is under `clearancePx`. */
function isTooClose(a: FlightSprite, b: FlightSprite) {
  const { clearancePx, spriteSizePx } = FLIGHT_SETTINGS;

  // Skip the polygon test for sprites with images more than `clearancePx` apart.
  if (Math.abs(a.x - b.x) >= spriteSizePx + clearancePx || Math.abs(a.y - b.y) >= spriteSizePx + clearancePx) {
    return false;
  }

  return gapBetween(a, b) < clearancePx - 1e-3;
}

function tooClosePairCountOf(flight: Flight) {
  const flyingSprites = flight.sprites.filter(({ isFlying }) => isFlying);
  return flyingSprites.reduce(
    (count, sprite, index) =>
      count + flyingSprites.slice(index + 1).filter((other) => isTooClose(sprite, other)).length,
    0,
  );
}

describe("createFlight", () => {
  test("returns a flight with every sprite waiting", () => {
    const flight = flightOf([MIXED_FLIGHT_PROFILE, MIXED_FLIGHT_PROFILE], Math.random);
    expect(flight.sprites.map(({ isFlying }) => isFlying)).toEqual([false, false]);
  });
});

describe("stagger", () => {
  test("leaves every sprite waiting", () => {
    const flight = flightOf(
      Array.from({ length: 12 }, () => MIXED_FLIGHT_PROFILE),
      createSeededRandom(1),
    );

    flight.stagger();

    expect(flight.sprites.filter(({ isFlying }) => isFlying)).toHaveLength(0);
  });

  test("makes the next `step` enter one sprite", () => {
    const flight = flightOf(
      Array.from({ length: 12 }, () => MIXED_FLIGHT_PROFILE),
      createSeededRandom(1),
    );

    flight.stagger();
    flight.step(STEP_S);

    expect(flight.sprites.filter(({ isFlying }) => isFlying)).toHaveLength(1);
  });

  test("spaces the sprites' entries evenly over the time the slowest sprite takes to cross the viewport", () => {
    const spriteCount = 12;
    const flight = flightOf(
      Array.from({ length: spriteCount }, () => MIXED_FLIGHT_PROFILE),
      createSeededRandom(1),
    );
    const intervalS = (VIEWPORT.width + FLIGHT_SETTINGS.spriteSizePx) / SLOW_SPEED_PX_PER_S / spriteCount;

    flight.stagger();

    const timesToEntryS = flight.sprites.map(({ timeToEntryS }) => timeToEntryS).sort((a, b) => a - b);

    for (const [index, timeToEntryS] of timesToEntryS.entries()) {
      expect(Math.abs(timeToEntryS - index * intervalS)).toBeLessThanOrEqual(intervalS / 2);
    }
  });

  test("shuffles the order of the sprites' entries with `random`", () => {
    const firstEntrantIndexes = new Set(
      [1, 2, 3, 4, 5].map((seed) => {
        const flight = flightOf(
          Array.from({ length: 12 }, () => MIXED_FLIGHT_PROFILE),
          createSeededRandom(seed),
        );

        flight.stagger();

        return flight.sprites.findIndex(({ timeToEntryS }) => timeToEntryS === 0);
      }),
    );

    expect(firstEntrantIndexes.size).toBeGreaterThan(1);
  });
});

describe("step", () => {
  test("enters a sprite on a lane just outside the right edge", () => {
    const flight = flightOf([FAST_FLIGHT_PROFILE], randomReturning(laneRandomAt(RIGHT_EDGE_ENTRY)));

    flight.step(STEP_S);

    expect(flight.sprites[0]!.isFlying).toBe(true);
    expect(flight.sprites[0]!.x).toBeCloseTo(RIGHT_EDGE_ENTRY.x);
    expect(flight.sprites[0]!.y).toBeCloseTo(RIGHT_EDGE_ENTRY.y);
  });

  test("enters a sprite on a lane just outside the top edge", () => {
    const entry = { x: VIEWPORT.width / 2, y: -FLIGHT_SETTINGS.spriteSizePx };
    const flight = flightOf([FAST_FLIGHT_PROFILE], randomReturning(laneRandomAt(entry)));

    flight.step(STEP_S);

    expect(flight.sprites[0]!.isFlying).toBe(true);
    expect(flight.sprites[0]!.x).toBeCloseTo(entry.x);
    expect(flight.sprites[0]!.y).toBeCloseTo(entry.y);
  });

  test("enters a sprite at one of the speeds of its profile", () => {
    const flight = flightOf([MIXED_FLIGHT_PROFILE], createSeededRandom(1));

    flight.step(STEP_S);

    expect(MIXED_FLIGHT_PROFILE.speedsPxPerS).toContain(flight.sprites[0]!.speedPxPerS);
  });

  test("enters a sprite at the random entry point farthest from a flying sprite", () => {
    const nearEntry = { x: VIEWPORT.width, y: 200 };
    const farEntry = { x: VIEWPORT.width, y: 400 };
    const flight = flightOf(
      [FAST_FLIGHT_PROFILE, FAST_FLIGHT_PROFILE],
      randomReturning(laneRandomAt(nearEntry), laneRandomAt(farEntry), laneRandomAt(nearEntry)),
    );
    const [flying, entering] = flight.sprites as [FlightSprite, FlightSprite];

    placeInFlight(flying, { x: VIEWPORT.width - 140, y: 100 }, FAST_SPEED_PX_PER_S);
    flight.step(STEP_S);

    expect(entering.x).toBeCloseTo(farEntry.x);
    expect(entering.y).toBeCloseTo(farEntry.y);
  });

  test("leaves a sprite waiting where entering would bring it within `clearancePx` of a flying sprite", () => {
    const flight = flightOf(
      [FAST_FLIGHT_PROFILE, FAST_FLIGHT_PROFILE],
      randomReturning(laneRandomAt(RIGHT_EDGE_ENTRY)),
    );

    flight.step(STEP_S);

    expect(flight.sprites.map(({ isFlying }) => isFlying)).toEqual([true, false]);
  });

  test("flies a sprite with a clear path left at its speed, descending `descentPerPx` for each pixel", () => {
    const flight = flightOf([FAST_FLIGHT_PROFILE], randomReturning(laneRandomAt(RIGHT_EDGE_ENTRY)));
    const elapsedS = 0.25;

    flight.step(STEP_S);

    const { x, y } = flight.sprites[0]!;

    flight.step(elapsedS);

    expect(flight.sprites[0]!.x).toBeCloseTo(x - FAST_SPEED_PX_PER_S * elapsedS);
    expect(flight.sprites[0]!.y).toBeCloseTo(y + FAST_SPEED_PX_PER_S * elapsedS * FLIGHT_SETTINGS.descentPerPx);
  });

  test("enters a sprite again on the step after it leaves the viewport", () => {
    const viewport = { width: 100, height: 100 };
    const entry = { x: viewport.width, y: 0 };
    const flight = flightOf([FAST_FLIGHT_PROFILE], randomReturning(laneRandomAt(entry, viewport)), viewport);
    const [sprite] = flight.sprites;

    flight.step(STEP_S);
    stepUntil(flight, () => !sprite!.isFlying);
    flight.step(STEP_S);

    expect(sprite!.isFlying).toBe(true);
    expect(sprite!.x).toBeCloseTo(entry.x);
    expect(sprite!.y).toBeCloseTo(entry.y);
  });

  describe("when a sprite catches up with a slower one on its lane", () => {
    function catchUp() {
      const flight = flightOf(
        [SLOW_FLIGHT_PROFILE, FAST_FLIGHT_PROFILE],
        randomReturning(laneRandomAt(RIGHT_EDGE_ENTRY)),
      );
      const [slowSprite, fastSprite] = flight.sprites as [FlightSprite, FlightSprite];

      let fastSpriteBefore = { isFlying: fastSprite.isFlying, x: fastSprite.x };

      stepUntil(flight, () => {
        const hasCaughtUp =
          fastSpriteBefore.isFlying && fastSprite.x - fastSpriteBefore.x > -FAST_SPEED_PX_PER_S * STEP_S + 1e-6;

        fastSpriteBefore = { isFlying: fastSprite.isFlying, x: fastSprite.x };

        return hasCaughtUp;
      });

      return { flight, slowSprite, fastSprite };
    }

    /**
     * Places a slow sprite, then a fast sprite with `fastProfile` in contact behind it on its lane, then a fast sprite
     * with each of `followerProfiles` in contact behind the one before.
     */
    function lineUp(fastProfile: FlightProfile, followerProfiles: ReadonlyArray<FlightProfile> = []) {
      const flight = flightOf([SLOW_FLIGHT_PROFILE, fastProfile, ...followerProfiles], Math.random);
      const [slowSprite, fastSprite, ...followers] = flight.sprites as [
        FlightSprite,
        FlightSprite,
        ...Array<FlightSprite>,
      ];
      const slowSpritePosition = { x: 300, y: 100 };

      placeInFlight(slowSprite, slowSpritePosition, SLOW_SPEED_PX_PER_S);
      placeInFlight(
        fastSprite,
        positionOnLane(laneOf(slowSpritePosition), slowSpritePosition.x + CONTACT_SPACING_PX),
        FAST_SPEED_PX_PER_S,
      );

      for (const [index, follower] of followers.entries()) {
        placeInFlight(
          follower,
          positionOnLane(laneOf(slowSpritePosition), fastSprite.x + (index + 1) * CONTACT_SPACING_PX),
          FAST_SPEED_PX_PER_S,
        );
      }

      return { flight, slowSprite, fastSprite };
    }

    test("flies the faster sprite at the slower one's speed, `clearancePx` behind it", () => {
      const { flight, slowSprite, fastSprite } = catchUp();
      const { x } = fastSprite;

      flight.step(STEP_S);

      expect(fastSprite.x - x).toBeCloseTo(-SLOW_SPEED_PX_PER_S * STEP_S);
      expect(gapBetween(fastSprite, slowSprite)).toBeCloseTo(FLIGHT_SETTINGS.clearancePx);
    });

    test("slides the faster sprite down the slower one's side and beneath it, then flies it at its own speed, where the faster one gives way", () => {
      const { flight, slowSprite, fastSprite } = catchUp();

      stepUntil(flight, () => {
        expect(slowSprite.isFlying && fastSprite.isFlying).toBe(true);
        expect(isTooClose(fastSprite, slowSprite)).toBe(false);

        return fastSprite.x < slowSprite.x;
      });

      expect(fastSprite.y + BOX_BOUNDS.top).toBeGreaterThanOrEqual(
        slowSprite.y + BOX_BOUNDS.bottom + FLIGHT_SETTINGS.clearancePx - 1e-3,
      );

      const { x, y } = fastSprite;

      flight.step(STEP_S);

      expect(fastSprite.x).toBeCloseTo(x - FAST_SPEED_PX_PER_S * STEP_S);
      expect(fastSprite.y).toBeCloseTo(y + FAST_SPEED_PX_PER_S * STEP_S * FLIGHT_SETTINGS.descentPerPx);
    });

    test("flies the faster sprite behind the slower one on its own lane, where the faster one does not give way", () => {
      const { flight, slowSprite, fastSprite } = lineUp(withoutGivingWay(FAST_FLIGHT_PROFILE));
      const lane = laneOf(fastSprite);

      stepTimes(flight, 10);

      expect(fastSprite.x - slowSprite.x).toBeCloseTo(CONTACT_SPACING_PX);
      expect(laneOf(fastSprite)).toBeCloseTo(lane);
      expect(fastSprite.speedPxPerS).toBe(FAST_SPEED_PX_PER_S);
      expect(slowSprite.speedPxPerS).toBe(SLOW_SPEED_PX_PER_S);
    });

    test("slides the faster sprite down instead of exchanging speeds, where another sprite follows in contact behind it", () => {
      const { flight, slowSprite, fastSprite } = lineUp(FAST_FLIGHT_PROFILE, [FAST_FLIGHT_PROFILE]);
      const lane = laneOf(fastSprite);

      flight.step(STEP_S);

      expect(laneOf(fastSprite)).toBeGreaterThan(lane);
      expect(fastSprite.speedPxPerS).toBe(FAST_SPEED_PX_PER_S);
      expect(slowSprite.speedPxPerS).toBe(SLOW_SPEED_PX_PER_S);
    });
  });

  describe("when a faster sprite approaches a slower one from another lane", () => {
    /**
     * Places a slow sprite, and a fast one clear behind it, `laneOffsetPx` above its lane (or below it, where
     * negative), both with `outline`.
     */
    function approachFromLane(laneOffsetPx: number, outline = BOX_OUTLINE) {
      const flight = flightOf(
        [
          { ...SLOW_FLIGHT_PROFILE, outline },
          { ...FAST_FLIGHT_PROFILE, outline },
        ],
        Math.random,
      );
      const [slowSprite, fastSprite] = flight.sprites as [FlightSprite, FlightSprite];
      const slowSpritePosition = { x: 300, y: 100 };

      placeInFlight(slowSprite, slowSpritePosition, SLOW_SPEED_PX_PER_S);
      placeInFlight(
        fastSprite,
        positionOnLane(laneOf(slowSpritePosition) - laneOffsetPx, slowSpritePosition.x + 120),
        FAST_SPEED_PX_PER_S,
      );

      return { flight, slowSprite, fastSprite };
    }

    /**
     * Steps `flight` until the image of `fastSprite` is wholly ahead of that of `slowSprite`, calling `onStep` before
     * each step, and asserts that both stay flying more than `clearancePx` apart.
     */
    function stepUntilPassed(
      flight: Flight,
      slowSprite: FlightSprite,
      fastSprite: FlightSprite,
      onStep: () => void = () => undefined,
    ) {
      stepUntil(flight, () => {
        expect(slowSprite.isFlying && fastSprite.isFlying).toBe(true);
        expect(isTooClose(fastSprite, slowSprite)).toBe(false);
        onStep();

        return fastSprite.x + FLIGHT_SETTINGS.spriteSizePx < slowSprite.x;
      });
    }

    test("flies the faster sprite past the slower one at its own speed where their images come within `clearancePx` but their outlines do not", () => {
      // The diamonds' facing edges stay 8 / √2px apart, while their images touch as the fast diamond passes.
      const { flight, slowSprite, fastSprite } = approachFromLane(72, DIAMOND_OUTLINE);
      const { clearancePx, spriteSizePx } = FLIGHT_SETTINGS;

      let previousX: number | null = null;
      let haveImagesComeWithinClearance = false;

      stepUntilPassed(flight, slowSprite, fastSprite, () => {
        if (previousX !== null) {
          expect(previousX - fastSprite.x).toBeCloseTo(FAST_SPEED_PX_PER_S * STEP_S);
        }

        previousX = fastSprite.x;
        haveImagesComeWithinClearance ||=
          Math.abs(fastSprite.x - slowSprite.x) - spriteSizePx < clearancePx &&
          Math.abs(fastSprite.y - slowSprite.y) - spriteSizePx < clearancePx;
      });

      expect(haveImagesComeWithinClearance).toBe(true);
    });

    test.each([1, 28, 56])(
      "moves the faster sprite past the slower one without widening the gap between them, from a lane %ipx above",
      (laneOffsetPx) => {
        const { flight, slowSprite, fastSprite } = approachFromLane(laneOffsetPx);

        let gapPx = fastSprite.x - slowSprite.x;

        stepUntilPassed(flight, slowSprite, fastSprite, () => {
          expect(fastSprite.x - slowSprite.x).toBeLessThanOrEqual(gapPx + 1e-6);
          gapPx = fastSprite.x - slowSprite.x;
        });
      },
    );

    test("passes the faster sprite over the slower one where it catches up with the upper half of the slower one's side", () => {
      const { flight, slowSprite, fastSprite } = approachFromLane(1);

      stepUntilPassed(flight, slowSprite, fastSprite);

      expect(laneOf(fastSprite)).toBeLessThan(laneOf(slowSprite));
    });

    test("passes the faster sprite beneath the slower one where it catches up with the lower half of the slower one's side", () => {
      const { flight, slowSprite, fastSprite } = approachFromLane(-1);

      stepUntilPassed(flight, slowSprite, fastSprite);

      expect(laneOf(fastSprite)).toBeGreaterThan(laneOf(slowSprite));
    });

    test("passes the faster sprite over the slower one where it catches up with the slower one's top-right corner", () => {
      const { flight, slowSprite, fastSprite } = approachFromLane(28);

      stepUntilPassed(flight, slowSprite, fastSprite);

      expect(laneOf(fastSprite)).toBeLessThan(laneOf(slowSprite));
    });
  });

  describe("when a sprite above stops a faster sprite from sliding up over a slower one", () => {
    /**
     * Places a slow sprite, and a fast sprite approaching its top-right corner from a lane above with another fast
     * sprite in contact directly above it, so the sprite above stops the fast sprite from sliding up when it catches
     * up.
     */
    function blockSlide(aheadProfile: FlightProfile) {
      const flight = flightOf([aheadProfile, FAST_FLIGHT_PROFILE, FAST_FLIGHT_PROFILE], Math.random);
      const [ahead, behind, above] = flight.sprites as [FlightSprite, FlightSprite, FlightSprite];
      const aheadPosition = { x: 300, y: 100 };
      const behindPosition = positionOnLane(laneOf(aheadPosition) - 28, aheadPosition.x + 120);

      placeInFlight(ahead, aheadPosition, SLOW_SPEED_PX_PER_S);
      placeInFlight(behind, behindPosition, FAST_SPEED_PX_PER_S);
      placeInFlight(above, { x: behindPosition.x, y: behindPosition.y - STACK_SPACING_PX }, FAST_SPEED_PX_PER_S);

      return { flight, ahead, behind, above };
    }

    test("exchanges the speeds of the faster sprite and the one ahead, where the one ahead gives way", () => {
      const { flight, ahead, behind } = blockSlide(SLOW_FLIGHT_PROFILE);

      stepUntil(flight, () => ahead.speedPxPerS !== SLOW_SPEED_PX_PER_S);

      expect(ahead.speedPxPerS).toBe(FAST_SPEED_PX_PER_S);
      expect(behind.speedPxPerS).toBe(SLOW_SPEED_PX_PER_S);
    });

    test("flies the faster sprite at the speed of the one ahead without exchanging their speeds, where the one ahead does not give way", () => {
      const { flight, ahead, behind, above } = blockSlide(withoutGivingWay(SLOW_FLIGHT_PROFILE));

      let heldStepCount = 0;
      let previousX = behind.x;

      stepUntil(flight, () => {
        expect(ahead.speedPxPerS).toBe(SLOW_SPEED_PX_PER_S);
        expect(behind.speedPxPerS).toBe(FAST_SPEED_PX_PER_S);
        expect(isTooClose(behind, ahead) || isTooClose(behind, above)).toBe(false);

        if (Math.abs(previousX - behind.x - SLOW_SPEED_PX_PER_S * STEP_S) < 1e-6) {
          heldStepCount++;
        }

        previousX = behind.x;

        return behind.x < ahead.x;
      });

      expect(heldStepCount).toBeGreaterThan(0);
    });
  });

  describe("in a crowded flight", { tags: ["slow"] }, () => {
    let tooClosePairCount = 0;
    let deviationCount = 0;
    let checkedStepCount = 0;

    // Steps a staggered flight of 30 sprites with mixed outlines and speeds for each of 10 seeds, in which some sprites
    // do not give way and fly no faster than any sprite that gives way. After each step, it counts the pairs of flying
    // sprites within `clearancePx` of each other, and the sprites that do not give way but stray from their speed or
    // lane.
    beforeAll(() => {
      for (let seed = 1; seed <= 10; seed++) {
        const random = createSeededRandom(seed);
        const flight = flightOf(
          Array.from({ length: 30 }, (_, index) => ({
            ...(index % 4 === 0 ? withoutGivingWay(SLOW_FLIGHT_PROFILE) : MIXED_FLIGHT_PROFILE),
            ...(index % 3 === 0 && { outline: DIAMOND_OUTLINE }),
          })),
          random,
        );
        const previousPositions = new Map<Readonly<FlightSprite>, Position>();

        flight.stagger();

        for (let step = 0; step < 3000; step++) {
          const elapsedS = random() * 0.1; // Frames of uneven length, like `requestAnimationFrame` delivers.

          flight.step(elapsedS);
          tooClosePairCount += tooClosePairCountOf(flight);

          for (const sprite of flight.sprites) {
            const previousPosition = previousPositions.get(sprite);

            if (!sprite.givesWay && sprite.isFlying && previousPosition) {
              const flownPx = previousPosition.x - sprite.x;

              checkedStepCount++;

              if (
                Math.abs(flownPx - SLOW_SPEED_PX_PER_S * elapsedS) > 1e-6 ||
                Math.abs(laneOf(sprite) - laneOf(previousPosition)) > 1e-6
              ) {
                deviationCount++;
              }
            }
          }

          for (const sprite of flight.sprites) {
            if (sprite.isFlying) {
              previousPositions.set(sprite, { x: sprite.x, y: sprite.y });
            } else {
              previousPositions.delete(sprite);
            }
          }
        }
      }
    }, 20_000); // The crowds take about 2 seconds alone, and up to 4 times as long while the rest of the suite runs.

    test("never brings two flying sprites within `clearancePx` of each other", () => {
      expect(tooClosePairCount).toBe(0);
    });

    test("flies each sprite that does not give way at its own speed on its own lane", () => {
      expect(checkedStepCount).toBeGreaterThan(0);
      expect(deviationCount).toBe(0);
    });
  });
});

describe("resize", () => {
  test("makes `step` enter sprites outside the right edge of the new viewport", () => {
    const viewport = { width: 1280, height: 960 };
    const entry = { x: viewport.width, y: 100 };
    const flight = flightOf([FAST_FLIGHT_PROFILE], randomReturning(laneRandomAt(entry, viewport)));

    flight.resize(viewport);
    flight.step(STEP_S);

    expect(flight.sprites[0]!.x).toBeCloseTo(entry.x);
    expect(flight.sprites[0]!.y).toBeCloseTo(entry.y);
  });
});
