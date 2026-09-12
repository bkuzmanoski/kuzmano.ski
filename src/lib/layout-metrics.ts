// This module has no imports, so build plugins can use it.

export const CSS_VARIABLE_PREFIX = "--layout-";

/** Lengths declared as CSS variables, in pixels, keyed by `metricKeyOf`. */
export type LayoutMetrics = Record<string, number>;

// Metrics use lowercase, hyphen-separated names and camel-case keys. These forms make `metricKeyOf`
// and `metricPropertyOf` inverses.
//
// Digits and uppercase letters are excluded from metric names because they are not reversible.
const METRIC_NAME = /^[a-z]+(?:-[a-z]+)*$/;
const METRIC_KEY = /^[a-z]+(?:[A-Z][a-z]*)*$/;

/** The key a property is read under: `--layout-window-layer-padding` is `windowLayerPadding`. */
export function metricKeyOf(property: string): string {
  const name = property.startsWith(CSS_VARIABLE_PREFIX) ? property.slice(CSS_VARIABLE_PREFIX.length) : "";

  if (!METRIC_NAME.test(name)) {
    throw new Error(
      `\`${property}\` is not a layout metric name. Layout metric names start with \`${CSS_VARIABLE_PREFIX}\` and use lowercase words separated by single hyphens.`,
    );
  }

  return name.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

export function metricPropertyOf(key: string): string {
  if (!METRIC_KEY.test(key)) {
    throw new Error(`\`${key}\` is not a layout metric key. Layout metric keys use letters only, in lower camel case.`);
  }

  return `${CSS_VARIABLE_PREFIX}${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** Returns a metric, throwing if no pixel length is declared for it. */
export function metricIn(metrics: LayoutMetrics, key: string): number {
  const value = metrics[key];

  if (value === undefined) {
    throw new Error(`\`${metricPropertyOf(key)}\` is not declared as a pixel length.`);
  }

  return value;
}
