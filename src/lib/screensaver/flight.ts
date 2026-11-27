import { depthOf, entryDistanceOf } from "../convex-polygon.ts";
import { distanceBetween } from "../geometry.ts";
import { randomElementOf, shuffled } from "../random.ts";

import { createOverlapRegions, extendedHalfPlanesOf, isNearRegion } from "./overlap-region.ts";

import type { NonEmptyReadonlyArray } from "../arrays.ts";
import type { ConvexPolygon } from "../convex-polygon.ts";
import type { Position, Size } from "../geometry.ts";

export interface FlightProfile {
  /** A convex polygon around the opaque pixels of the sprite's image, in pixels from its top-left corner. */
  outline: ConvexPolygon;
  speedsPxPerS: NonEmptyReadonlyArray<number>;
  /**
   * Whether the sprite may change its lane or `speedPxPerS` when it catches up with a slower sprite, or when a faster
   * sprite catches up with it. A sprite that does not give way never changes either.
   */
  givesWay: boolean;
}

export interface FlightSettings {
  spriteSizePx: number;
  /** Vertical descent per horizontal pixel flown left. */
  descentPerPx: number;
  /** Minimum gap between two sprites' outlines. */
  clearancePx: number;
  /** Number of random entry points compared when placing an entering sprite. */
  placementAttempts: number;
}

export interface FlightState extends Position {
  /** `false` while the sprite waits off screen to enter. */
  isFlying: boolean;
  /** Horizontal flight speed when the sprite's path is clear. */
  speedPxPerS: number;
  /** Seconds until a waiting sprite tries to enter; at or below `0`, it retries every step. */
  timeToEntryS: number;
}

/** A sprite in a flight, with the properties of its profile. */
export type FlightSprite<TProfile extends FlightProfile = FlightProfile> = TProfile & FlightState;

export interface Flight<TProfile extends FlightProfile = FlightProfile> {
  /** Sprites in the same order as the profiles passed to `createFlight`. */
  readonly sprites: ReadonlyArray<Readonly<FlightSprite<TProfile>>>;
  /**
   * Spaces the entries of the waiting sprites evenly, in random order, over the time the slowest of them takes to cross
   * the viewport, with the first entering on the next step.
   */
  stagger: () => void;
  /** Flies each flying sprite for `elapsedS`, and enters each waiting sprite with a `timeToEntryS` that has run out. */
  step: (elapsedS: number) => void;
  /** Updates the viewport bounds for future steps without changing the sprite count. */
  resize: (viewport: Size) => void;
}

export interface FlightOptions<TProfile extends FlightProfile = FlightProfile> {
  profiles: ReadonlyArray<TProfile>;
  viewport: Size;
  settings: FlightSettings;
  /** Returns a number in `[0, 1)`. */
  random: () => number;
}

// Floating-point tolerance for treating two sprites as touching when one stops against another.
const CONTACT_TOLERANCE_PX = 1e-6;

// The directions in which the offset of another sprite moves, in lane coordinates, as a sprite flies forward or slides
// to another lane. Flying keeps a sprite on its lane and sliding keeps it in its column, so each moves the offset along
// one axis.
const OFFSET_DIRECTION_FLYING_FORWARD: Position = { x: 1, y: 0 };
const OFFSET_DIRECTION_SLIDING_DOWN: Position = { x: 0, y: -1 };
const OFFSET_DIRECTION_SLIDING_UP: Position = { x: 0, y: 1 };

const offsetAlong = (offset: Position, direction: Position, distancePx: number): Position => ({
  x: offset.x + direction.x * distancePx,
  y: offset.y + direction.y * distancePx,
});

/**
 * Creates a flight where sprites enter beyond the top or right edge, fly diagonally left and down, and recycle off
 * screen after exiting the left or bottom edge.
 */
export function createFlight<TProfile extends FlightProfile>({
  profiles,
  viewport,
  settings,
  random,
}: FlightOptions<TProfile>): Flight<TProfile> {
  const { spriteSizePx, descentPerPx, clearancePx, placementAttempts } = settings;
  const overlapRegionBetween = createOverlapRegions({ descentPerPx, clearancePx });
  const parkedPositionPx = -spriteSizePx;
  const sprites: Array<FlightSprite<TProfile>> = profiles.map((profile) => ({
    ...profile,
    isFlying: false,
    x: parkedPositionPx,
    y: parkedPositionPx,
    speedPxPerS: 0,
    timeToEntryS: 0,
  }));
  const flightOrder = [...sprites];

  let currentViewport = viewport;

  // Returns the lane containing a point. Lanes descend `descentPerPx` per pixel to the left, so in lane coordinates
  // (x = column, y = lane) forward motion changes only x and lane changes change only y.
  const laneOf = ({ x, y }: Position) => y + descentPerPx * x;

  // Returns `other`'s offset from `position` in lane coordinates.
  const offsetOf = (other: FlightSprite, position: Position): Position => ({
    x: other.x - position.x,
    y: laneOf(other) - laneOf(position),
  });

  const overlapRegionOf = (sprite: FlightSprite, other: FlightSprite) =>
    overlapRegionBetween(sprite.outline, other.outline);
  const reachOf = (other: FlightSprite, elapsedS: number) => other.speedPxPerS * elapsedS;
  const otherFlyingSprites = (sprite: FlightSprite) => sprites.filter((other) => other !== sprite && other.isFlying);
  const isClearAt = (sprite: FlightSprite, others: ReadonlyArray<FlightSprite>, position: Position, elapsedS: number) =>
    others.every((other) => {
      const overlapRegion = overlapRegionOf(sprite, other);
      const reachPx = reachOf(other, elapsedS);
      const offset = offsetOf(other, position);

      return (
        !isNearRegion(overlapRegion, reachPx, offset, offset) ||
        depthOf(extendedHalfPlanesOf(overlapRegion, reachPx), offset) <= CONTACT_TOLERANCE_PX
      );
    });

  function park(sprite: FlightSprite, timeToEntryS: number) {
    sprite.isFlying = false;
    sprite.x = parkedPositionPx;
    sprite.y = parkedPositionPx;
    sprite.timeToEntryS = timeToEntryS;
  }

  function randomEntryPoint(): Position {
    const { width, height } = currentViewport;
    const lowestOffsetPx = -spriteSizePx * (1 + descentPerPx);
    const highestOffsetPx = height + descentPerPx * width;
    const offsetPx = lowestOffsetPx + random() * (highestOffsetPx - lowestOffsetPx);
    const yAtRightEdgePx = offsetPx - descentPerPx * width;

    return yAtRightEdgePx >= -spriteSizePx
      ? { x: width, y: yAtRightEdgePx }
      : { x: (offsetPx + spriteSizePx) / descentPerPx, y: -spriteSizePx };
  }

  function launch(sprite: FlightSprite, { x, y }: Position) {
    sprite.isFlying = true;
    sprite.x = x;
    sprite.y = y;
    sprite.speedPxPerS = randomElementOf(sprite.speedsPxPerS, random);
  }

  // Compares `placementAttempts` random entry points and places `sprite` at the clear one farthest from any flying
  // sprite (avoiding clumps and gaps), or leaves it waiting if all violate clearance.
  function enter(sprite: FlightSprite, elapsedS: number) {
    const others = otherFlyingSprites(sprite);

    let entryPoint: Position | null = null;
    let entryDistancePx = -Infinity;

    for (let attempt = 0; attempt < placementAttempts; attempt++) {
      const candidate = randomEntryPoint();

      if (isClearAt(sprite, others, candidate, elapsedS)) {
        const candidateDistancePx = Math.min(...others.map((other) => distanceBetween(other, candidate)));

        if (candidateDistancePx > entryDistancePx) {
          entryPoint = candidate;
          entryDistancePx = candidateDistancePx;
        }
      }
    }

    if (entryPoint) {
      launch(sprite, entryPoint);
    }
  }

  // Returns how far `sprite` can fly left along its lane (up to `distancePx`) and the blocking sprite ahead, if any.
  function forwardStopOf(sprite: FlightSprite, distancePx: number) {
    let flownPx = distancePx;
    let spriteAhead: FlightSprite | null = null;
    let spriteAheadLaneGapPx = Infinity;

    for (const other of otherFlyingSprites(sprite)) {
      const overlapRegion = overlapRegionOf(sprite, other);
      const offset = offsetOf(other, sprite);

      if (!isNearRegion(overlapRegion, 0, offset, offsetAlong(offset, OFFSET_DIRECTION_FLYING_FORWARD, distancePx))) {
        continue;
      }

      const entryDistancePx = entryDistanceOf(
        overlapRegion.halfPlanes,
        offset,
        OFFSET_DIRECTION_FLYING_FORWARD,
        CONTACT_TOLERANCE_PX,
      );

      if (entryDistancePx === null || entryDistancePx > flownPx + CONTACT_TOLERANCE_PX) {
        continue;
      }

      // Of the sprites that stop it at the same distance, the sprite ahead is the one on the nearest lane, which the
      // sprite slides around.
      const laneGapPx = Math.abs(offset.y);

      if (entryDistancePx < flownPx - CONTACT_TOLERANCE_PX || laneGapPx < spriteAheadLaneGapPx) {
        flownPx = Math.min(flownPx, entryDistancePx);
        spriteAhead = other;
        spriteAheadLaneGapPx = laneGapPx;
      }
    }

    return { flownPx, spriteAhead: flownPx < distancePx - CONTACT_TOLERANCE_PX ? spriteAhead : null };
  }

  function flyForward(sprite: FlightSprite, distancePx: number) {
    const lane = laneOf(sprite);

    sprite.x -= distancePx;
    sprite.y = lane - descentPerPx * sprite.x;
  }

  // Slides `sprite` vertically by up to `distancePx` away from the midpoint of its overlap region with `spriteAhead`
  // (up if in the upper half, down if in the lower half), returning whether another sprite stopped it short.
  function slideAround(sprite: FlightSprite, spriteAhead: FlightSprite, distancePx: number, elapsedS: number) {
    const { top, bottom } = overlapRegionOf(sprite, spriteAhead);
    const isSlidingUp = offsetOf(spriteAhead, sprite).y > (top + bottom) / 2 + CONTACT_TOLERANCE_PX;
    const direction = isSlidingUp ? OFFSET_DIRECTION_SLIDING_UP : OFFSET_DIRECTION_SLIDING_DOWN;

    let slidPx = distancePx;

    for (const other of otherFlyingSprites(sprite)) {
      const overlapRegion = overlapRegionOf(sprite, other);
      const reachPx = reachOf(other, elapsedS);
      const offset = offsetOf(other, sprite);

      if (!isNearRegion(overlapRegion, reachPx, offset, offsetAlong(offset, direction, distancePx))) {
        continue;
      }

      const halfPlanes = extendedHalfPlanesOf(overlapRegion, reachPx);
      const entryDistancePx = entryDistanceOf(halfPlanes, offset, direction, CONTACT_TOLERANCE_PX);

      if (entryDistancePx !== null) {
        slidPx = Math.min(slidPx, entryDistancePx);
      } else if (
        // The sprite already lies in the path of `other` for this step, so it slides only where that does not move it
        // deeper.
        depthOf(halfPlanes, offsetAlong(offset, direction, CONTACT_TOLERANCE_PX)) > depthOf(halfPlanes, offset)
      ) {
        slidPx = 0;
      }
    }

    sprite.y += isSlidingUp ? -slidPx : slidPx;

    return slidPx < distancePx - CONTACT_TOLERANCE_PX;
  }

  return {
    sprites,
    stagger() {
      const waitingSprites = shuffled(
        sprites.filter(({ isFlying }) => !isFlying),
        random,
      );
      const slowestSpeedPxPerS = Math.min(...waitingSprites.flatMap(({ speedsPxPerS }) => speedsPxPerS));
      const intervalS = (currentViewport.width + spriteSizePx) / slowestSpeedPxPerS / waitingSprites.length;

      for (const [index, sprite] of waitingSprites.entries()) {
        // The first sprite enters on the next step, so the viewport does not start empty.
        park(sprite, index === 0 ? 0 : (index - 0.5 + random()) * intervalS);
      }
    },
    step(elapsedS) {
      const movedSprites = new Set<FlightSprite>();

      // Advances `sprite` by `elapsedS` and returns `true`, or returns `false` without moving if `canWait` is `true`
      // and an unmoved sprite ahead blocks it.
      function move(sprite: FlightSprite, canWait: boolean) {
        if (sprite.isFlying) {
          const distancePx = sprite.speedPxPerS * elapsedS;
          const { flownPx, spriteAhead } = forwardStopOf(sprite, distancePx);

          // The sort by `x` measures each sprite from the top-left corner of its image instead of its outline, so a
          // sprite ahead can come later in the sort. Waiting for it makes this sprite stop against the position that
          // the sprite ahead reaches in this step.
          if (canWait && spriteAhead && !movedSprites.has(spriteAhead)) {
            return false;
          }

          flyForward(sprite, flownPx);

          // A sprite that gives way also slides to another lane by the descent of the distance it could not fly, so it
          // passes above or below the sprite ahead.
          if (spriteAhead && sprite.givesWay) {
            const isSlideStopped = slideAround(sprite, spriteAhead, descentPerPx * (distancePx - flownPx), elapsedS);

            // When another sprite stops the slide, the sprite and the sprite ahead exchange speeds if both give way, so
            // the sprite ahead flies on at the faster speed instead of both flying at the slower one.
            if (isSlideStopped && spriteAhead.givesWay && spriteAhead.speedPxPerS < sprite.speedPxPerS) {
              [sprite.speedPxPerS, spriteAhead.speedPxPerS] = [spriteAhead.speedPxPerS, sprite.speedPxPerS];
            }
          }

          if (sprite.x <= -spriteSizePx || sprite.y >= currentViewport.height) {
            park(sprite, 0);
          }
        } else {
          sprite.timeToEntryS -= elapsedS;

          if (sprite.timeToEntryS <= 0) {
            enter(sprite, elapsedS);
          }
        }

        movedSprites.add(sprite);

        return true;
      }

      // Move the leftmost sprites first, so each sprite stops against the positions that the sprites ahead of it reach
      // in this step instead of where they were before it.
      flightOrder.sort((a, b) => a.x - b.x);

      let waitingSprites = flightOrder.filter((sprite) => !move(sprite, true));

      while (waitingSprites.length > 0) {
        const stillWaitingSprites = waitingSprites.filter((sprite) => !move(sprite, true));

        if (stillWaitingSprites.length === waitingSprites.length) {
          // The waiting sprites stop each other in a cycle, so the first sprite that gives way (or the first sprite,
          // where none does) moves without waiting.
          const firstSprite = stillWaitingSprites.find(({ givesWay }) => givesWay) ?? stillWaitingSprites[0]!;

          move(firstSprite, false);
          waitingSprites = stillWaitingSprites.filter((sprite) => sprite !== firstSprite);
        } else {
          waitingSprites = stillWaitingSprites;
        }
      }
    },
    resize(nextViewport) {
      currentViewport = nextViewport;
    },
  };
}
