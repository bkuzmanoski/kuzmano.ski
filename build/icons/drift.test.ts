import { expect, test } from "vitest";

import { findIconDrift, findInputDrift } from "./drift.ts";
import { readIconInputs } from "./lock.ts";

const inputs = await readIconInputs();

test("the generated icons match the current palette and artwork", async () => {
  expect(await findIconDrift()).toEqual([]);
});

test("a changed palette is detected as drift", () => {
  const stale = {
    ...inputs,
    palette: { ...inputs.palette, foregroundLight: "#000000" },
  };

  expect(findInputDrift(stale, inputs)).toEqual([
    expect.stringContaining("foregroundLight #000000") as unknown as string,
  ]);
});

test("changed artwork is detected as drift", () => {
  const stale = { ...inputs, artwork: "0".repeat(64) };
  expect(findInputDrift(stale, inputs)).toEqual([expect.stringContaining("logo.svg") as unknown as string]);
});

test("a changed fill is detected as drift", () => {
  const stale = {
    ...inputs,
    fills: { ...inputs.fills, maskable: 0.5 },
  };
  expect(findInputDrift(stale, inputs)).toEqual([
    expect.stringContaining("the maskable fill at 0.5") as unknown as string,
  ]);
});

test("a lock file that is not an object is detected as drift", () => {
  expect(findInputDrift(null, inputs)).toHaveLength(1);
  expect(findInputDrift("#353535", inputs)).toHaveLength(1);
});

test("an empty lock file reports every input as drift", () => {
  expect(findInputDrift({}, inputs)).toHaveLength(
    1 + Object.keys(inputs.fills).length + Object.keys(inputs.palette).length,
  );
});
