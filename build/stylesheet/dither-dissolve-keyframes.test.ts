import postcss from "postcss";
import postcssMixins from "postcss-mixins";
import { describe, expect, test } from "vitest";

import { renderDitherField } from "#/lib/dither/dither-field.ts";

import { ditherDissolveKeyframes } from "./dither-dissolve-keyframes.ts";

import type { AtRule, Declaration, Rule } from "postcss";

const TILE_SIZE = 8;

const emittedKeyframes = async () => {
  const { root } = await postcss([
    postcssMixins({ mixins: { "dither-dissolve-keyframes": ditherDissolveKeyframes } }),
  ]).process("@mixin dither-dissolve-keyframes;", { from: undefined });
  const atRule = root.first as AtRule;
  const rules = (atRule.nodes ?? []) as Array<Rule>;

  return {
    atRule,
    keyframes: rules.map((rule) => {
      const valueOf = (property: string) =>
        (rule.nodes as Array<Declaration>).find((declaration) => declaration.prop === property)?.value ?? "";
      const maskImageLayers = valueOf("mask-image").split(/,\s*(?=url\()/);

      return {
        offsetPercent: Number.parseFloat(rule.selector),
        maskImage: maskImageLayers[0] ?? "",
        maskImageLayers,
        maskComposite: valueOf("mask-composite"),
      };
    }),
  };
};
const filledCellsOfMaskImage = (maskImage: string) => {
  const filledCells: Array<string> = [];

  for (const [, startX = "0", y = "0", width = "0"] of maskImage.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    for (let x = Number(startX); x < Number(startX) + Number(width); x += 1) {
      filledCells.push(`${x},${y}`);
    }
  }

  return [...filledCells].sort();
};
const filledCellsOfDitherField = (density: number) => {
  const rgba = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
  const filledCells: Array<string> = [];

  renderDitherField(
    { width: TILE_SIZE, height: TILE_SIZE, density: new Float32Array(TILE_SIZE * TILE_SIZE).fill(density) },
    { color: [0, 0, 0] },
    rgba,
  );

  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if (rgba[(y * TILE_SIZE + x) * 4 + 3] === 255) {
        filledCells.push(`${x},${y}`);
      }
    }
  }

  return [...filledCells].sort();
};

describe("ditherDissolveKeyframes", () => {
  test("emits `@keyframes dither-dissolve` at the root of the stylesheet through `postcss-mixins`", async () => {
    const { atRule } = await emittedKeyframes();

    expect(atRule.name).toBe("keyframes");
    expect(atRule.params).toBe("dither-dissolve");
  });

  test("starts on a `mask-image` without filled cells at `0%`, and ends on a `mask-image` of `none` at `100%`", async () => {
    const { keyframes } = await emittedKeyframes();

    expect(keyframes.at(0)?.offsetPercent).toBe(0);
    expect(filledCellsOfMaskImage(keyframes.at(0)?.maskImage ?? "")).toEqual([]);
    expect(keyframes.at(-1)?.offsetPercent).toBe(100);
    expect(keyframes.at(-1)?.maskImage).toBe("none");
  });

  test("fills the same cells in each step as a dither field of the same density", async () => {
    const { keyframes } = await emittedKeyframes();
    const steps = keyframes.slice(0, -1);

    expect(steps).toHaveLength(16);
    steps.forEach(({ maskImage }, step) => {
      expect(filledCellsOfMaskImage(maskImage)).toEqual(filledCellsOfDitherField(step / 16));
    });
  });

  test("lists the `mask-image` of every step at `0%` with a `mask-composite` of `intersect`, and one `mask-image` with a `mask-composite` of `add` at each later keyframe", async () => {
    const { keyframes } = await emittedKeyframes();
    const [firstKeyframe, ...laterKeyframes] = keyframes;

    expect(firstKeyframe?.maskImageLayers).toEqual(keyframes.slice(0, -1).map(({ maskImage }) => maskImage));
    expect(firstKeyframe?.maskComposite).toBe("intersect");
    laterKeyframes.forEach(({ maskImageLayers, maskComposite }) => {
      expect(maskImageLayers).toHaveLength(1);
      expect(maskComposite).toBe("add");
    });
  });

  test("widens the gap between consecutive steps from the first step to the last", async () => {
    const { keyframes } = await emittedKeyframes();
    const gaps = keyframes
      .slice(1)
      .map(({ offsetPercent }, index) => offsetPercent - (keyframes[index]?.offsetPercent ?? 0));

    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(gaps.at(-1)).toBeGreaterThan(gaps.at(0) ?? Infinity);
  });
});
