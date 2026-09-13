import { describe, expect, test } from "vitest";

import { metricIn, metricKeyOf, metricPropertyOf } from "./layout-metrics.ts";

describe("metricKeyOf", () => {
  test("returns the camel case key corresponding to a hyphenated property name", () => {
    expect(metricKeyOf("--layout-window-layer-padding")).toBe("windowLayerPadding");
  });

  test("returns the word itself as the key for a single-word property name", () => {
    expect(metricKeyOf("--layout-gutter")).toBe("gutter");
  });

  test("throws for a property name containing a digit", () => {
    expect(() => metricKeyOf("--layout-scale-2x")).toThrow("`--layout-scale-2x` is not a layout metric name");
    expect(() => metricKeyOf("--layout-scale2x")).toThrow("`--layout-scale2x` is not a layout metric name");
  });

  test("throws for a property name containing an uppercase letter", () => {
    expect(() => metricKeyOf("--layout-fooBar")).toThrow("`--layout-fooBar` is not a layout metric name");
  });

  test("throws for a property name without the `--layout-` prefix", () => {
    expect(() => metricKeyOf("--color-foreground")).toThrow("`--color-foreground` is not a layout metric name");
  });

  test("throws for a property name containing an empty word", () => {
    expect(() => metricKeyOf("--layout-")).toThrow("`--layout-` is not a layout metric name");
    expect(() => metricKeyOf("--layout-safe--area")).toThrow("`--layout-safe--area` is not a layout metric name");
  });
});

describe("metricPropertyOf", () => {
  test("returns the property corresponding to a key", () => {
    expect(metricPropertyOf("windowLayerPadding")).toBe("--layout-window-layer-padding");
  });

  test("throws for a key that is not lower camel case", () => {
    expect(() => metricPropertyOf("scale2x")).toThrow("`scale2x` is not a layout metric key");
    expect(() => metricPropertyOf("WindowLayerPadding")).toThrow("`WindowLayerPadding` is not a layout metric key");
  });

  test("round-trips a property name to a key and back to the same property name", () => {
    for (const property of ["--layout-gutter", "--layout-title-bar-height", "--layout-safe-area-inset-top"]) {
      expect(metricPropertyOf(metricKeyOf(property))).toBe(property);
    }
  });
});

describe("metricIn", () => {
  test("returns the metric for a key", () => {
    expect(metricIn({ gutter: 16 }, "gutter")).toBe(16);
  });

  test("throws for a key without a metric, naming its custom property", () => {
    expect(() => metricIn({}, "windowLayerPadding")).toThrow("`--layout-window-layer-padding` is not declared");
  });

  test("returns a metric declared as zero rather than treating it as absent", () => {
    expect(metricIn({ gutter: 0 }, "gutter")).toBe(0);
  });
});
