/**
 * Resolves `color` (e.g., `var(--color-desktop-background)`) to its computed value.
 *
 * When provided, `colorScheme` controls how scheme-dependent colors such as `light-dark()` are resolved.
 * Forced colors are disabled on the probe.
 */
export function computedColorOf(color: string, colorScheme?: "light" | "dark"): string {
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
