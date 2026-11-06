import type { ColorScheme } from "./settings/theme.ts";

/**
 * Resolves `color` (e.g., `var(--color-desktop-background)`) to its computed value.
 *
 * When provided, `colorScheme` controls how scheme-dependent colors such as `light-dark()` are resolved. Forced colors
 * are disabled on the probe.
 */
export function computedColorOf(color: string, colorScheme?: ColorScheme): string {
  const probe = document.createElement("span");

  probe.hidden = true;
  probe.style.color = color;
  probe.style.forcedColorAdjust = "none";

  if (colorScheme) {
    probe.style.colorScheme = colorScheme;
  }

  document.body.append(probe);

  const computedColor = getComputedStyle(probe).color;

  probe.remove();

  return computedColor;
}

export type Rgb = readonly [number, number, number];

/** Returns the RGB bytes rendered for `color` on a canvas, excluding alpha, or `null` if no 2D context is available. */
export function rgbOf(color: string): Rgb | null {
  const context = document.createElement("canvas").getContext("2d");

  if (!context) {
    return null;
  }

  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

  return [red, green, blue];
}
