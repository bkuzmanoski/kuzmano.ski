export function clamp(value: number, floor: number, ceiling: number): number {
  return Math.max(Math.min(value, ceiling), floor);
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function cycle(length: number, from: number, direction: 1 | -1): number {
  if (length === 0) {
    return 0;
  }

  if (from < 0) {
    return direction === 1 ? 0 : length - 1;
  }

  return (from + direction + length) % length;
}
