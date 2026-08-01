export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Steps an index by `direction` around a list of `length`, wrapping at both
 * ends. An index of -1 (not found) steps to the first or the last entry.
 */
export function cycle(length: number, from: number, direction: 1 | -1): number {
  return length === 0 ? 0 : (from + direction + length) % length;
}
