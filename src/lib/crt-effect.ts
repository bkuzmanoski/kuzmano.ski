import { insetRect, scaleInset } from "./geometry";

import type { Inset, Rect } from "./geometry";

const BEZEL: Inset = { top: 28, right: 24, bottom: 28, left: 24 };
const CORNER_RADIUS = 16;
const EDGE_BOW = 8;

const round = (value: number) => Math.round(value * 100) / 100;

function clipPath(width: number, height: number, radius: number, bow: number): string {
  const w = round(width);
  const h = round(height);
  const r = round(radius);
  const c = round(bow);
  const midX = round(width / 2);
  const midY = round(height / 2);

  return `path("${[
    `M${c + r} ${c}`,
    `Q${midX} 0 ${w - c - r} ${c}`,
    `Q${w - c} ${c} ${w - c} ${c + r}`,
    `Q${w} ${midY} ${w - c} ${h - c - r}`,
    `Q${w - c} ${h - c} ${w - c - r} ${h - c}`,
    `Q${midX} ${h} ${c + r} ${h - c}`,
    `Q${c} ${h - c} ${c} ${h - c - r}`,
    `Q0 ${midY} ${c} ${c + r}`,
    `Q${c} ${c} ${c + r} ${c}`,
    "Z",
  ].join("")}")`;
}

export interface ScreenParameters {
  box: Rect;
  inset: Inset;
  radius: number;
  clipPath: string;
}

export function screenParametersFor(display: Rect, scale: number): ScreenParameters {
  const inset = scaleInset(BEZEL, scale);
  const box = insetRect(display, inset);

  return {
    box,
    inset,
    radius: CORNER_RADIUS * scale,
    clipPath: clipPath(box.width, box.height, CORNER_RADIUS * scale, EDGE_BOW * scale),
  };
}
