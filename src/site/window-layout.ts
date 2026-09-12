import { LAYOUT_METRICS } from "virtual:layout-metrics";

import { WINDOW_MIN_SIZE, WINDOW_SPECS } from "#/config/desktop.ts";
import { metricIn } from "#/lib/layout-metrics.ts";
import type { WindowLayout } from "#/lib/window-manager/window.ts";

/** Defines the bounds and constraints used to place and resize windows. */
export const WINDOW_LAYOUT: WindowLayout = {
  windows: WINDOW_SPECS,
  minSize: WINDOW_MIN_SIZE,
  padding: metricIn(LAYOUT_METRICS, "windowLayerPadding"),
};
