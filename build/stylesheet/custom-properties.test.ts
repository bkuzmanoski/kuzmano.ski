import { describe, expect, test } from "vitest";

import { rootCustomPropertiesIn } from "./custom-properties.ts";

const read = (css: string) => rootCustomPropertiesIn(css, "src/styles.css");

describe("rootCustomPropertiesIn", () => {
  test("returns the custom properties declared in `:root`, keyed by name", () => {
    expect(read(":root { --color-foreground: #000000; --layout-gutter: 16px; }")).toEqual(
      new Map([
        ["--color-foreground", "#000000"],
        ["--layout-gutter", "16px"],
      ]),
    );
  });

  test("returns the last value written for a property declared twice", () => {
    expect(read(":root { --layout-gutter: 16px; --layout-gutter: 20px; }").get("--layout-gutter")).toBe("20px");
  });

  test("omits a declaration in a rule nested inside `:root`", () => {
    const css = ':root { --layout-gutter: 16px; &[data-theme="dark"] { --layout-gutter: 99px; } }';
    expect(read(css).get("--layout-gutter")).toBe("16px");
  });

  test("omits a declaration in a `:root` inside an at-rule", () => {
    const css = ":root { --layout-gutter: 16px; } @media (width < 600px) { :root { --layout-gutter: 8px; } }";
    expect(read(css).get("--layout-gutter")).toBe("16px");
  });

  test("omits a declaration that is not a custom property", () => {
    expect(read(":root { color: red; --layout-gutter: 16px; }")).toEqual(new Map([["--layout-gutter", "16px"]]));
  });

  test("throws when the stylesheet has no `:root` block, naming the source", () => {
    expect(() => read("body { color: red; }")).toThrow("No `:root` block found in src/styles.css.");
  });

  test("throws when a `:root` block never closes", () => {
    expect(() => read(":root { --layout-gutter: 16px;")).toThrow("Unclosed block");
  });
});
