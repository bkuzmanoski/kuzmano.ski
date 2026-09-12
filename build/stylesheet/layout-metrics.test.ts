import { describe, expect, test } from "vitest";

import { layoutMetricsFrom } from "./layout-metrics.ts";

const stylesheet = (declarations: Record<string, string>) =>
  `:root {\n${Object.entries(declarations)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")}\n}`;

describe("layoutMetricsFrom", () => {
  test("reads every `--layout-*` pixel length the stylesheet declares", () => {
    const css = stylesheet({ "--layout-gutter": "16px", "--layout-menu-bar-height": "32px" });
    expect(layoutMetricsFrom(css)).toEqual({ gutter: 16, menuBarHeight: 32 });
  });

  test("omits a custom property without the `--layout-` prefix", () => {
    const css = stylesheet({ "--layout-gutter": "16px", "--color-foreground": "#000000", "--shadow": "3px" });
    expect(layoutMetricsFrom(css)).toEqual({ gutter: 16 });
  });

  test("reads a fractional length without rounding it", () => {
    expect(layoutMetricsFrom(stylesheet({ "--layout-gutter": "16.5px" })).gutter).toBe(16.5);
  });

  test("reads the forms CSS accepts as a length", () => {
    const css = stylesheet({
      "--layout-a": "0",
      "--layout-b": "4PX",
      "--layout-c": ".5px",
      "--layout-d": "+4px",
      "--layout-e": "-4px",
    });
    expect(layoutMetricsFrom(css)).toEqual({ a: 0, b: 4, c: 0.5, d: 4, e: -4 });
  });

  test("omits a `--layout-*` value that is not a pixel length rather than throwing", () => {
    const css = stylesheet({
      "--layout-safe-area-top": "env(safe-area-inset-top, 0px)",
      "--layout-column-width": "40rem",
      "--layout-inset": "calc(16px + 2px)",
      "--layout-spread": "16px 4px",
      "--layout-gutter": "16px",
    });

    expect(layoutMetricsFrom(css)).toEqual({ gutter: 16 });
  });

  test("throws when a `--layout-*` property name is not lowercase words, naming the property", () => {
    expect(() => layoutMetricsFrom(stylesheet({ "--layout-scale-2x": "1px" }))).toThrow(
      "`--layout-scale-2x` is not a layout metric name",
    );
    expect(() => layoutMetricsFrom(stylesheet({ "--layout-fooBar": "env(safe-area-inset-top)" }))).toThrow(
      "`--layout-fooBar` is not a layout metric name",
    );
  });
});
