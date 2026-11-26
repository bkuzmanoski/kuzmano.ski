import { describe, expect, test } from "vitest";

import { hookOf, throwError } from "../test-utils/plugin-hooks.ts";

import { cssTargetFrom, cssTargetPlugin, loweredStylesheetFileNamesIn } from "./css-target.ts";

import type { Rollup } from "vite";

type GenerateBundle = (
  this: { error: (message: string) => never },
  options: unknown,
  bundle: Record<string, Partial<Rollup.OutputAsset> | Partial<Rollup.OutputChunk>>,
) => void;

describe("cssTargetFrom", () => {
  test("returns each browser once, at its lowest version", () => {
    expect(cssTargetFrom(["chrome 127", "chrome 125", "chrome 126", "firefox 128", "firefox 126"])).toEqual([
      "chrome125",
      "firefox126",
    ]);
  });

  test("compares versions as numbers, ranking `17.6` below `17.10`", () => {
    expect(cssTargetFrom(["safari 18.0", "safari 17.6", "safari 17.10"])).toEqual(["safari17.6"]);
  });

  test("names iOS Safari `ios`", () => {
    expect(cssTargetFrom(["ios_saf 17.5"])).toEqual(["ios17.5"]);
  });

  test("counts a version range as its start", () => {
    expect(cssTargetFrom(["ios_saf 18.5-18.7", "ios_saf 26.0"])).toEqual(["ios18.5"]);
  });

  test("omits a browser that esbuild cannot name and a version that is not numeric", () => {
    expect(cssTargetFrom(["and_chr 154", "and_ff 157", "safari TP", "op_mini all", "chrome 125"])).toEqual([
      "chrome125",
    ]);
  });
});

describe("loweredStylesheetFileNamesIn", () => {
  test("returns the file names of the stylesheets that declare a `--lightningcss-*` custom property", () => {
    expect(
      loweredStylesheetFileNamesIn([
        { fileName: "assets/native.css", source: ":root{--a:light-dark(#fff,#000)}" },
        {
          fileName: "assets/lowered.css",
          source: ":root{--a:var(--lightningcss-light,#fff) var(--lightningcss-dark,#000)}",
        },
      ]),
    ).toEqual(["assets/lowered.css"]);
  });
});

describe("cssTargetPlugin", () => {
  const generateBundle = hookOf<GenerateBundle>(cssTargetPlugin(), "generateBundle");

  test("throws for an emitted stylesheet that declares a `--lightningcss-*` custom property, naming the stylesheet", () => {
    expect(() =>
      generateBundle.call(
        { error: throwError },
        {},
        {
          "assets/index.css": {
            type: "asset",
            fileName: "assets/index.css",
            source: new TextEncoder().encode(":root{color-scheme:var(--lightningcss-light)}"),
          },
        },
      ),
    ).toThrow("in assets/index.css.");
  });

  test("accepts an emitted stylesheet without a `--lightningcss-*` custom property and ignores a chunk that contains one", () => {
    expect(() =>
      generateBundle.call(
        { error: throwError },
        {},
        {
          "assets/index.css": { type: "asset", fileName: "assets/index.css", source: ":root{color:red}" },
          "assets/index.js": { type: "chunk", fileName: "assets/index.js", code: "--lightningcss-light" },
        },
      ),
    ).not.toThrow();
  });
});
