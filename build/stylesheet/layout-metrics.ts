import { readFile } from "node:fs/promises";

import valueParser from "postcss-value-parser";

import { CSS_VARIABLE_PREFIX, metricKeyOf } from "#/lib/layout-metrics.ts";
import type { LayoutMetrics } from "#/lib/layout-metrics.ts";

import { STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";

import { rootCustomPropertiesIn } from "./custom-properties.ts";
import { stylesheetValuePlugin } from "./stylesheet-value.ts";

import type { Plugin } from "vite";

function pixelLengthIn(value: string): number | null {
  const parsedLength = valueParser.unit(value.trim());

  if (!parsedLength || parsedLength.number === "") {
    return null;
  }

  const pixels = Number(parsedLength.number);
  const unit = parsedLength.unit.toLowerCase();

  if (Number.isNaN(pixels) || (unit !== "px" && !(unit === "" && pixels === 0))) {
    return null;
  }

  return pixels;
}

export function layoutMetricsFrom(css: string): LayoutMetrics {
  const metrics: LayoutMetrics = {};

  for (const [property, value] of rootCustomPropertiesIn(css, STYLESHEET_FILE_PATH)) {
    if (!property.startsWith(CSS_VARIABLE_PREFIX)) {
      continue;
    }

    const metricKey = metricKeyOf(property);
    const pixels = pixelLengthIn(value);

    if (pixels !== null) {
      metrics[metricKey] = pixels;
    }
  }

  return metrics;
}

export const readLayoutMetrics = async (): Promise<LayoutMetrics> =>
  layoutMetricsFrom(await readFile(fromRoot(STYLESHEET_FILE_PATH), "utf8"));

/** Exposes the stylesheet's layout metrics through `virtual:layout-metrics`. */
export const layoutMetricsPlugin = (): Plugin =>
  stylesheetValuePlugin({
    name: "kuzmano.ski:layout-metrics",
    moduleId: "virtual:layout-metrics",
    exportName: "LAYOUT_METRICS",
    read: readLayoutMetrics,
  });
