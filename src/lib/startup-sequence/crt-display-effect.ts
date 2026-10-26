import { insetRect, scaleInset } from "../geometry.ts";

import type { Inset, Rect } from "../geometry.ts";

const CORNER_RADIUS = 16;
const EDGE_BOW = 8;

const round = (value: number) => Math.round(value * 100) / 100;

function clipPath(rawWidth: number, rawHeight: number, rawRadius: number, rawBow: number): string {
  const width = round(rawWidth);
  const height = round(rawHeight);
  const radius = round(rawRadius);
  const bow = round(rawBow);
  const midX = round(rawWidth / 2);
  const midY = round(rawHeight / 2);

  return `path("${[
    `M${bow + radius} ${bow}`,
    `Q${midX} 0 ${width - bow - radius} ${bow}`,
    `Q${width - bow} ${bow} ${width - bow} ${bow + radius}`,
    `Q${width} ${midY} ${width - bow} ${height - bow - radius}`,
    `Q${width - bow} ${height - bow} ${width - bow - radius} ${height - bow}`,
    `Q${midX} ${height} ${bow + radius} ${height - bow}`,
    `Q${bow} ${height - bow} ${bow} ${height - bow - radius}`,
    `Q0 ${midY} ${bow} ${bow + radius}`,
    `Q${bow} ${bow} ${bow + radius} ${bow}`,
    "Z",
  ].join("")}")`;
}

export interface ScreenParameters {
  box: Rect;
  inscribedBox: Rect; // `box` inset by the edge bow, so a rounded rectangle of `radius` on it lies inside `clipPath`.
  inset: Inset;
  radius: number;
  clipPath: string;
}

export function screenParametersFor(display: Rect, bezel: Inset, scale: number): ScreenParameters {
  const inset = scaleInset(bezel, scale);
  const box = insetRect(display, inset);
  const bow = EDGE_BOW * scale;

  return {
    box,
    inscribedBox: insetRect(box, { top: bow, right: bow, bottom: bow, left: bow }),
    inset,
    radius: CORNER_RADIUS * scale,
    clipPath: clipPath(box.width, box.height, CORNER_RADIUS * scale, bow),
  };
}
