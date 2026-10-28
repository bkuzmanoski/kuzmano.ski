import { describe, expect, test } from "vitest";

import { themeDefaultsFrom } from "./theme-defaults.ts";

const stylesheet = (chromaScale: string) => `
:root {
  --theme-chroma-scale: ${chromaScale};
}
`;

describe("themeDefaultsFrom", () => {
  test("returns the chroma scale the stylesheet declares", () => {
    expect(themeDefaultsFrom(stylesheet("1.5"))).toEqual({ chromaScale: 1.5 });
  });

  test.for(["4", "-0.25", "1.1", "100%", "var(--theme-chroma-scale)"])(
    "throws when the chroma scale is `%s`, naming the property",
    (chromaScale) => {
      expect(() => themeDefaultsFrom(stylesheet(chromaScale))).toThrow(
        `\`--theme-chroma-scale\` is \`${chromaScale}\`. Expected a number from 0 to 2.5 in steps of 0.25.`,
      );
    },
  );

  test("throws when the stylesheet does not declare the chroma scale, naming the property", () => {
    expect(() => themeDefaultsFrom(":root { --layout-gutter: 16px; }")).toThrow(
      "`--theme-chroma-scale` is not declared in `:root`.",
    );
  });
});
