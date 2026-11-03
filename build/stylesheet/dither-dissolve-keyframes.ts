import postcss from "postcss";

import { BAYER_MATRIX_SIZE, thresholdAt } from "#/lib/dither/bayer-matrix.ts";

import type { AtRule } from "postcss";

export const DITHER_DISSOLVE_KEYFRAMES_MIXIN_NAME = "dither-dissolve-keyframes";
export const DITHER_DISSOLVE_STEP_COUNT = 16;

/** A `mask-image` of one tile of the Bayer matrix, filled in the same cells as a dither field of `density`. */
function ditherMaskImageOf(density: number): string {
  let path = "";

  for (let y = 0; y < BAYER_MATRIX_SIZE; y += 1) {
    let runStartX: number | null = null;

    for (let x = 0; x <= BAYER_MATRIX_SIZE; x += 1) {
      const isFilled = x < BAYER_MATRIX_SIZE && density > thresholdAt(x, y);

      if (isFilled) {
        runStartX ??= x;
      } else if (runStartX !== null) {
        path += `M${runStartX} ${y}h${x - runStartX}v1H${runStartX}z`;
        runStartX = null;
      }
    }
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${BAYER_MATRIX_SIZE} ${BAYER_MATRIX_SIZE}' shape-rendering='crispEdges'><path d='${path}'/></svg>`;

  return `url("data:image/svg+xml,${svg.replaceAll("<", "%3C").replaceAll(">", "%3E")}")`;
}

/** Emits `@keyframes dither-dissolve` before `mixin`. */
export function ditherDissolveKeyframes(mixin: AtRule): void {
  const { source } = mixin;
  const maskImages = Array.from({ length: DITHER_DISSOLVE_STEP_COUNT }, (_, step) =>
    ditherMaskImageOf(step / DITHER_DISSOLVE_STEP_COUNT),
  );
  const keyframes = postcss.atRule({ name: "keyframes", params: "dither-dissolve", source });

  for (let step = 0; step <= DITHER_DISSOLVE_STEP_COUNT; step += 1) {
    // Ease-out spacing places earlier steps closer together.
    const offset = 1 - Math.sqrt(1 - step / DITHER_DISSOLVE_STEP_COUNT);

    // Preload later masks while the initial frame is displayed as Firefox otherwise briefly hides an element while each
    // asynchronously loaded mask becomes available.
    const [maskImage, maskComposite] =
      step === 0 ? [maskImages.join(", "), "intersect"] : [maskImages[step] ?? "none", "add"];

    keyframes.append(
      postcss
        .rule({ selector: `${(offset * 100).toFixed(2)}%`, source })
        .append(
          postcss.decl({ prop: "mask-image", value: maskImage, source }),
          postcss.decl({ prop: "mask-composite", value: maskComposite, source }),
        ),
    );
  }

  // Inserting nodes directly preserves their source; nodes parsed by `postcss-mixins` below the top level lack one.
  mixin.before(keyframes);
}
