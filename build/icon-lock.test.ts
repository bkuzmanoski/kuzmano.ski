import { expect, test } from "vitest";

import { findIconDrift, findInputDrift, readIconInputs } from "./icon-lock.ts";

const inputs = await readIconInputs();

test("the icons in public/ were generated from the palette and artwork in the tree", async () => {
  expect(await findIconDrift()).toEqual([]);
});

test("a palette the icons were not generated with is drift", () => {
  const stale = { ...inputs, palette: { ...inputs.palette, foregroundLight: "#000000" } };
  expect(findInputDrift(stale, inputs)).toEqual([
    expect.stringContaining("foregroundLight #000000") as unknown as string,
  ]);
});

test("artwork edited since the last generation is drift", () => {
  const stale = { ...inputs, artwork: "0".repeat(64) };
  expect(findInputDrift(stale, inputs)).toEqual([expect.stringContaining("logo.svg") as unknown as string]);
});

test("a fill the icons were not generated with is drift", () => {
  const stale = { ...inputs, fills: { ...inputs.fills, maskable: 0.5 } };
  expect(findInputDrift(stale, inputs)).toEqual([
    expect.stringContaining("the maskable fill at 0.5") as unknown as string,
  ]);
});

test("a lock file that is not an object is drift", () => {
  expect(findInputDrift(null, inputs)).toHaveLength(1);
  expect(findInputDrift("#353535", inputs)).toHaveLength(1);
});

test("a lock file missing the inputs entirely reports each input", () => {
  expect(findInputDrift({}, inputs)).toHaveLength(
    1 + Object.keys(inputs.fills).length + Object.keys(inputs.palette).length,
  );
});
