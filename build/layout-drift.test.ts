import { expect, test } from "vitest";

import { WINDOW_LAYOUT } from "#/config/desktop.ts";

import { findLayoutDrift, readLayoutDrift } from "./layout-drift.ts";

const STYLESHEET: Record<string, string> = {
  "--window-layer-padding": `${WINDOW_LAYOUT.padding}px`,
};

function stylesheet(declarations: Record<string, string>): string {
  const lines = Object.entries(declarations).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

test("the site stylesheet mirrors every metric in `WINDOW_LAYOUT`", async () => {
  expect(await readLayoutDrift()).toEqual([]);
});

test("lengths that match `WINDOW_LAYOUT` are not detected as drift", () => {
  expect(findLayoutDrift(stylesheet(STYLESHEET))).toEqual([]);
});

test("a changed padding is detected as drift", () => {
  const css = stylesheet({ ...STYLESHEET, "--window-layer-padding": `${WINDOW_LAYOUT.padding + 1}px` });
  expect(findLayoutDrift(css)).toEqual([expect.stringContaining("`--window-layer-padding`") as unknown as string]);
});

test("a drift message names both values", () => {
  const css = stylesheet({ ...STYLESHEET, "--window-layer-padding": "99px" });
  const [message] = findLayoutDrift(css);

  expect(message).toContain("99px");
  expect(message).toContain(`${WINDOW_LAYOUT.padding}px`);
});

test("a missing custom property is detected as drift", () => {
  expect(findLayoutDrift(stylesheet({}))).toEqual([
    expect.stringContaining("does not declare `--window-layer-padding`"),
  ]);
});

test("a length that is not in pixels is detected as drift", () => {
  const css = stylesheet({ ...STYLESHEET, "--window-layer-padding": "0.75rem" });
  expect(findLayoutDrift(css)).toEqual([expect.stringContaining("not a pixel length") as unknown as string]);
});

test("comments around a declaration are ignored", () => {
  const css = `:root {\n  /* Metrics */\n${Object.entries(STYLESHEET)
    .map(([name, value]) => `  ${name}: ${value}; /* mirrored */`)
    .join("\n")}\n}`;
  expect(findLayoutDrift(css)).toEqual([]);
});
