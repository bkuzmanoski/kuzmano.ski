import { expect, test } from "vitest";

import { isSteppedValueIn } from "../stepped-range.ts";

import { DEFAULT_THEME_CHROMA_SCALE, THEME_CHROMA_SCALE_RANGE } from "./theme-tint.ts";

test("`DEFAULT_THEME_CHROMA_SCALE` is a step of the `Saturation` slider", () => {
  expect(isSteppedValueIn(DEFAULT_THEME_CHROMA_SCALE, THEME_CHROMA_SCALE_RANGE)).toBe(true);
});
