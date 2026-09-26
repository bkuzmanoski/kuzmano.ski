import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ACCENT_COLOR_NAMES, accentColorVariable } from "./accent-colors.ts";

const stylesheet = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("ACCENT_COLOR_NAMES", () => {
  test("lists every `--accent-*` color `/src/styles.css` declares, and only those", () => {
    const declaredAccentColorNames = [...stylesheet.matchAll(/^\s*--accent-([a-z]+):/gm)].map((match) => match[1]);
    expect([...ACCENT_COLOR_NAMES].sort()).toEqual(declaredAccentColorNames.sort());
  });
});

describe("accentColorVariable", () => {
  test("sets the given custom property to the accent's `--accent-*` color", () => {
    expect(accentColorVariable("--component-accent", "teal")).toEqual({ "--component-accent": "var(--accent-teal)" });
  });
});
