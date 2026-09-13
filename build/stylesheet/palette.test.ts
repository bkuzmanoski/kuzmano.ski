import { describe, expect, test } from "vitest";

import { paletteFrom, readPalette } from "./palette.ts";

import type { Palette } from "./palette.ts";

const REQUIRED_PROPERTIES = [
  "--color-foreground",
  "--color-background",
  "--color-wallpaper",
  "--color-boot-sequence-backdrop",
];

function stylesheet(declarations: Record<string, string>): string {
  const lines = [
    ...REQUIRED_PROPERTIES.map((name) => `  ${name}: #000000;`),
    ...Object.entries(declarations).map(([name, value]) => `  ${name}: ${value};`),
  ];
  return `:root {\n${lines.join("\n")}\n}`;
}

const lightValueOf = async (value: string, otherProperties: Record<string, string> = {}) =>
  (await paletteFrom(stylesheet({ ...otherProperties, "--color-foreground": value }))).foreground.light;
const darkValueOf = async (value: string, otherProperties: Record<string, string> = {}) =>
  (await paletteFrom(stylesheet({ ...otherProperties, "--color-foreground": value }))).foreground.dark;

describe("paletteFrom", () => {
  test("resolves a hex literal to the same lowercase hex literal in both schemes", async () => {
    const palette = await paletteFrom(stylesheet({ "--color-foreground": "#AABBCC" }));

    expect(palette.foreground.light).toBe("#aabbcc");
    expect(palette.foreground.dark).toBe("#aabbcc");
  });

  test("expands a three-digit hex literal", async () => {
    await expect(lightValueOf("#abc")).resolves.toBe("#aabbcc");
  });

  test("omits the alpha channel of a hex literal", async () => {
    await expect(lightValueOf("#aabbccdd")).resolves.toBe("#aabbcc");
  });

  test("resolves every property the palette needs", async () => {
    const palette = await paletteFrom(
      stylesheet({
        "--color-foreground": "light-dark(#111111, #222222)",
        "--color-background": "light-dark(#333333, #444444)",
        "--color-wallpaper": "light-dark(#555555, #666666)",
        "--color-boot-sequence-backdrop": "light-dark(#777777, #888888)",
      }),
    );
    expect(palette).toEqual({
      foreground: { light: "#111111", dark: "#222222" },
      background: { light: "#333333", dark: "#444444" },
      wallpaper: { light: "#555555", dark: "#666666" },
      bootSequenceBackdrop: { light: "#777777", dark: "#888888" },
    });
  });

  test("throws when a property the palette needs is not declared", async () => {
    await expect(paletteFrom(":root { --color-foreground: #ffffff; }")).rejects.toThrow("--color-background");
  });

  test("throws when a property the palette needs is declared empty", async () => {
    await expect(lightValueOf("")).rejects.toThrow("`--color-foreground` is not declared");
  });
});

describe("light-dark()", () => {
  test("takes the first argument for light and the second for dark", async () => {
    await expect(lightValueOf("light-dark(#ffffff, #000000)")).resolves.toBe("#ffffff");
    await expect(darkValueOf("light-dark(#ffffff, #000000)")).resolves.toBe("#000000");
  });

  test("resolves an argument that is itself a function", async () => {
    await expect(lightValueOf("light-dark(oklch(1 0 0), oklch(0 0 0))")).resolves.toBe("#ffffff");
    await expect(darkValueOf("light-dark(oklch(1 0 0), oklch(0 0 0))")).resolves.toBe("#000000");
  });

  test("takes the argument a comment precedes, rather than the comment", async () => {
    await expect(darkValueOf("light-dark(#ffffff, /* the same step */ #000000)")).resolves.toBe("#000000");
    await expect(lightValueOf("light-dark(/* the lighter step */ #ffffff, #000000)")).resolves.toBe("#ffffff");
  });

  test("throws when an argument is missing", async () => {
    await expect(darkValueOf("light-dark(#ffffff)")).rejects.toThrow("needs two arguments");
  });
});

describe("var()", () => {
  test("resolves a reference", async () => {
    await expect(lightValueOf("var(--accent)", { "--accent": "#ff0000" })).resolves.toBe("#ff0000");
  });

  test("resolves a chain of references", async () => {
    await expect(lightValueOf("var(--a)", { "--a": "var(--b)", "--b": "var(--c)", "--c": "#00ff00" })).resolves.toBe(
      "#00ff00",
    );
  });

  test("resolves a reference nested inside a color function", async () => {
    await expect(lightValueOf("oklch(from var(--accent) l c h)", { "--accent": "#1e90ff" })).resolves.toBe("#1e90ff");
  });

  test("resolves to the declared value rather than the fallback when the property is declared", async () => {
    await expect(lightValueOf("var(--accent, #000000)", { "--accent": "#ff0000" })).resolves.toBe("#ff0000");
  });

  test("resolves to the fallback when the property is not declared", async () => {
    await expect(lightValueOf("var(--missing, #0000ff)")).resolves.toBe("#0000ff");
  });

  test("throws when the property is not declared and there is no fallback", async () => {
    await expect(lightValueOf("var(--missing)")).rejects.toThrow("`--missing` is not declared");
  });

  test("treats an empty declaration as undeclared", async () => {
    await expect(lightValueOf("var(--empty, #0000ff)", { "--empty": "" })).resolves.toBe("#0000ff");
    await expect(lightValueOf("var(--empty)", { "--empty": "" })).rejects.toThrow("`--empty` is not declared");
  });

  test("throws when custom properties reference each other in a cycle, naming each property in the cycle", async () => {
    await expect(lightValueOf("var(--a)", { "--a": "var(--b)", "--b": "var(--a)" })).rejects.toThrow(
      /cycle.*--a.*--b.*--a/s,
    );
  });

  test("throws when a property refers back to itself", async () => {
    await expect(lightValueOf("var(--color-foreground)")).rejects.toThrow("cycle");
  });
});

describe("color notations", () => {
  test("resolves an `oklch()` to the sRGB color it represents", async () => {
    await expect(lightValueOf("oklch(1 0 0)")).resolves.toBe("#ffffff");
    await expect(lightValueOf("oklch(50% 0 0)")).resolves.toBe("#636363");
  });

  test("resolves a relative color", async () => {
    // No code here reads `from`, or the `l c h` keywords: the PostCSS plugins do. A notation the
    // stylesheet starts using later resolves the same way, without a change to this module.
    await expect(lightValueOf("oklch(from #1e90ff l 0 h)")).resolves.toBe("#909090");
  });

  test("resolves a `color-mix()`", async () => {
    await expect(lightValueOf("color-mix(in srgb, #ff0000 50%, #0000ff)")).resolves.toBe("#800080");
    await expect(
      lightValueOf("color-mix(in srgb, var(--scrim) 60%, transparent)", { "--scrim": "oklch(33% 0.0152 238deg)" }),
    ).resolves.toBe("#2e373c");
  });

  test("resolves an `oklch()` outside the sRGB gamut to the sRGB color it is clipped to", async () => {
    await expect(lightValueOf("oklch(70% 0.35 150deg)")).resolves.toBe("#00be58");
  });

  test("throws when the color plugins do not convert a notation", async () => {
    await expect(lightValueOf("hsl(0 100% 50%)")).rejects.toThrow("Cannot resolve `hsl(0 100% 50%)`");
    await expect(lightValueOf("rebeccapurple")).rejects.toThrow("Cannot resolve `rebeccapurple`");
  });

  test("throws when a value does not compute to a color", async () => {
    await expect(lightValueOf("not-a-color(1)")).rejects.toThrow("Cannot resolve");
    await expect(lightValueOf("var(--a) var(--b)", { "--a": "#ffffff", "--b": "#000000" })).rejects.toThrow(
      "Cannot resolve",
    );
  });
});

describe("rgb()", () => {
  test("resolves the three channels and omits the alpha channel", async () => {
    await expect(lightValueOf("rgb(1 2 3)")).resolves.toBe("#010203");
    await expect(lightValueOf("rgba(1, 2, 3, 0.5)")).resolves.toBe("#010203");
    await expect(lightValueOf("rgb(1 2 3 / 50%)")).resolves.toBe("#010203");
  });

  test("resolves a percentage channel to its share of 255", async () => {
    await expect(lightValueOf("rgb(100% 0% 50%)")).resolves.toBe("#ff0080");
  });

  test("clamps a channel outside 0 to 255 rather than producing a malformed hex literal", async () => {
    await expect(lightValueOf("rgb(300 -5 0)")).resolves.toBe("#ff0000");
    await expect(lightValueOf("rgb(150% 0 0)")).resolves.toBe("#ff0000");
  });

  test("throws when a channel is not a number", async () => {
    await expect(lightValueOf("rgb(none 0 0)")).rejects.toThrow("Cannot resolve");
  });

  test("throws when there are fewer than three channels", async () => {
    await expect(lightValueOf("rgb(1 2)")).rejects.toThrow("Cannot resolve");
  });
});

describe("readPalette", () => {
  test("resolves every color in the site stylesheet to a six-digit lowercase hex literal", async () => {
    const palette = await readPalette();

    expect(Object.keys(palette)).toHaveLength(4);

    for (const name of Object.keys(palette) as Array<keyof Palette>) {
      expect(palette[name].light, `${name}.light`).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette[name].dark, `${name}.dark`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("resolves the light and dark schemes to different colors", async () => {
    const palette = await readPalette();

    expect(palette.foreground.light).not.toBe(palette.foreground.dark);
    expect(palette.background.light).not.toBe(palette.background.dark);
  });
});
