import type { NonEmptyReadonlyArray } from "./arrays.ts";

/** Creates a Mulberry32 pseudo-random number generator seeded to produce a repeatable `[0, 1)` sequence. */
export function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a random integer in `[0, count)`. */
export const randomIntegerBelow = (count: number, random: () => number) => Math.floor(random() * count);

/** Returns a random element of `items`. */
export const randomElementOf = <T>(items: NonEmptyReadonlyArray<T>, random: () => number): T =>
  items[randomIntegerBelow(items.length, random)]!;

/** Returns a copy of `items` in random order. */
export function shuffled<T>(items: ReadonlyArray<T>, random: () => number): Array<T> {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index--) {
    const swapIndex = randomIntegerBelow(index + 1, random);
    [shuffledItems[index], shuffledItems[swapIndex]] = [shuffledItems[swapIndex]!, shuffledItems[index]!];
  }

  return shuffledItems;
}
