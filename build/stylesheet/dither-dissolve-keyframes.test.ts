import postcss from "postcss";
import postcssMixins from "postcss-mixins";
import { describe, expect, test } from "vitest";

import { BAYER_MATRIX_SIZE } from "#/lib/dither/bayer-matrix.ts";
import { renderDitherField } from "#/lib/dither/dither-field.ts";

import {
  DITHER_DISSOLVE_KEYFRAMES_MIXIN_NAME,
  DITHER_DISSOLVE_STEP_COUNT,
  ditherDissolveKeyframes,
} from "./dither-dissolve-keyframes.ts";

import type { AtRule, Declaration, Rule } from "postcss";

const emittedKeyframes = async () => {
  const { root } = await postcss([
    postcssMixins({ mixins: { [DITHER_DISSOLVE_KEYFRAMES_MIXIN_NAME]: ditherDissolveKeyframes } }),
  ]).process(`@mixin ${DITHER_DISSOLVE_KEYFRAMES_MIXIN_NAME};`, { from: undefined });
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
  const rgba = new Uint8ClampedArray(BAYER_MATRIX_SIZE * BAYER_MATRIX_SIZE * 4);
  const filledCells: Array<string> = [];

  renderDitherField(
    {
      width: BAYER_MATRIX_SIZE,
      height: BAYER_MATRIX_SIZE,
      density: new Float32Array(BAYER_MATRIX_SIZE * BAYER_MATRIX_SIZE).fill(density),
    },
    { color: [0, 0, 0] },
    rgba,
  );

  for (let y = 0; y < BAYER_MATRIX_SIZE; y += 1) {
    for (let x = 0; x < BAYER_MATRIX_SIZE; x += 1) {
      if (rgba[(y * BAYER_MATRIX_SIZE + x) * 4 + 3] === 255) {
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

    expect(steps).toHaveLength(DITHER_DISSOLVE_STEP_COUNT);
    steps.forEach(({ maskImage }, step) => {
      expect(filledCellsOfMaskImage(maskImage)).toEqual(filledCellsOfDitherField(step / DITHER_DISSOLVE_STEP_COUNT));
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

  test("holds the step at half density longer than any other step", async () => {
    const { keyframes } = await emittedKeyframes();
    const gaps = keyframes
      .slice(1)
      .map(({ offsetPercent }, index) => offsetPercent - (keyframes[index]?.offsetPercent ?? 0));

    expect(gaps.indexOf(Math.max(...gaps))).toBe(DITHER_DISSOLVE_STEP_COUNT / 2);
    expect(gaps.filter((gap) => gap === Math.max(...gaps))).toHaveLength(1);
  });
});
