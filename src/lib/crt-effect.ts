import { insetRect, scaleInset } from "./geometry";

import type { Inset, Rect } from "./geometry";

export const PHOSPHOR_COLOR = "#d9e1f2";

const BEZEL: Inset = { top: 28, right: 24, bottom: 28, left: 24 };
const CORNER_RADIUS = 16;
const EDGE_BOW = 8;
const BLOOM_CORE_RADIUS = 1.25;
const BLOOM_HALO_RADIUS = 6;
const BLOOM_HALO_INTENSITY = 0.3;
const BLOOM_KNEE = "0 0 0.35 1";
const SCANLINE_PITCH = 2;
const SCANLINE_ALPHA = 0.2;

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

function scanlines(top: number, ratio: number): Scanlines {
  const devicePitch = Math.max(2, 2 * Math.round((SCANLINE_PITCH * ratio) / 2));
  const offGrid = (((top * ratio) % 1) + 1) % 1;

  return { pitch: devicePitch / ratio, alpha: SCANLINE_ALPHA, offset: -offGrid / ratio || 0 };
}

/**
 * Bloom parameters.
 *
 * - `coreRadius` is the blur that keeps to the edges of lit shapes.
 * - `haloRadius` is the blur that carries light off a lit area onto the screen around it.
 * - `haloIntensity` is the slope of the transfer function for the halo.
 * - `knee` is the transfer table for the alpha of the bloom, over the luminance of the source.
 */
export interface Bloom {
  coreRadius: number;
  haloRadius: number;
  haloIntensity: number;
  knee: string;
}

/**
 * Scanline parameters.
 *
 * - `pitch` is the distance from one scanline to the next, in CSS pixels.
 * - `alpha` is the alpha of the unlit half of each pitch.
 * - `offset` is the shift, in CSS pixels, that pulls the grille back onto the device pixel grid.
 */
export interface Scanlines {
  pitch: number;
  alpha: number;
  offset: number;
}

export interface ScreenParameters {
  box: Rect;
  inset: Inset;
  radius: number;
  clipPath: string;
  bloom: Bloom;
  scanlines: Scanlines;
}

export function screenParametersFor(display: Rect, scale: number, devicePixelRatio: number): ScreenParameters {
  const inset = scaleInset(BEZEL, scale);
  const box = insetRect(display, inset);

  return {
    box,
    inset,
    radius: CORNER_RADIUS * scale,
    clipPath: clipPath(box.width, box.height, CORNER_RADIUS * scale, EDGE_BOW * scale),
    bloom: {
      coreRadius: BLOOM_CORE_RADIUS * scale,
      haloRadius: BLOOM_HALO_RADIUS * scale,
      haloIntensity: BLOOM_HALO_INTENSITY,
      knee: BLOOM_KNEE,
    },
    scanlines: scanlines(box.y, devicePixelRatio > 0 ? devicePixelRatio : 1),
  };
}
