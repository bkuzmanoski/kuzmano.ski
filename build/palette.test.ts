import { describe, expect, test } from "vitest";

import { normalizeHex, paletteFrom, readPalette } from "./palette.ts";

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

const light = (value: string, others: Record<string, string> = {}) =>
  paletteFrom(stylesheet({ ...others, "--color-foreground": value })).foregroundLight;
const dark = (value: string, others: Record<string, string> = {}) =>
  paletteFrom(stylesheet({ ...others, "--color-foreground": value })).foregroundDark;

describe("normalizeHex", () => {
  test("lowercases a six digit literal", () => {
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
  });

  test("expands a three digit literal", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  test("omits the alpha channel", () => {
    expect(normalizeHex("#aabbccdd")).toBe("#aabbcc");
    expect(normalizeHex("#abcd")).toBe("#aabbcc");
  });

  test("ignores surrounding whitespace", () => {
    expect(normalizeHex("  #abc\n")).toBe("#aabbcc");
  });

  test("returns undefined for anything that is not a hex color", () => {
    expect(normalizeHex("oklch(0.5 0 0)")).toBeUndefined();
    expect(normalizeHex("red")).toBeUndefined();
    expect(normalizeHex("#12345")).toBeUndefined();
    expect(normalizeHex("#zzzzzz")).toBeUndefined();
    expect(normalizeHex("")).toBeUndefined();
  });
});

describe("paletteFrom", () => {
  test("reads a hex literal into both schemes", () => {
    const palette = paletteFrom(stylesheet({ "--color-foreground": "#AABBCC" }));

    expect(palette.foregroundLight).toBe("#aabbcc");
    expect(palette.foregroundDark).toBe("#aabbcc");
  });

  test("reads every property the palette needs", () => {
    const palette = paletteFrom(
      stylesheet({
        "--color-foreground": "light-dark(#111111, #222222)",
        "--color-background": "light-dark(#333333, #444444)",
        "--color-wallpaper": "light-dark(#555555, #666666)",
        "--color-boot-sequence-backdrop": "light-dark(#777777, #888888)",
      }),
    );
    expect(palette).toEqual({
      foregroundLight: "#111111",
      foregroundDark: "#222222",
      backgroundLight: "#333333",
      backgroundDark: "#444444",
      wallpaperLight: "#555555",
      wallpaperDark: "#666666",
      bootSequenceBackdropLight: "#777777",
      bootSequenceBackdropDark: "#888888",
    });
  });

  test("throws when a property the palette needs is not declared", () => {
    expect(() => paletteFrom(":root { --color-foreground: #ffffff; }")).toThrow("--color-background");
  });

  test("throws when a property the palette needs is declared empty", () => {
    expect(() => light("")).toThrow("`--color-foreground` is not declared");
  });

  test("ignores declarations that are not custom properties", () => {
    expect(light("#ffffff", { color: "red" })).toBe("#ffffff");
  });
});

describe("light-dark", () => {
  test("takes the first argument for light and the second for dark", () => {
    expect(light("light-dark(#ffffff, #000000)")).toBe("#ffffff");
    expect(dark("light-dark(#ffffff, #000000)")).toBe("#000000");
  });

  test("resolves an argument that is itself a function", () => {
    expect(light("light-dark(oklch(1 0 0), oklch(0 0 0))")).toBe("#ffffff");
    expect(dark("light-dark(oklch(1 0 0), oklch(0 0 0))")).toBe("#000000");
  });

  test("throws when an argument is missing", () => {
    expect(() => dark("light-dark(#ffffff)")).toThrow("needs two arguments");
  });
});

describe("var()", () => {
  test("resolves a reference", () => {
    expect(light("var(--accent)", { "--accent": "#ff0000" })).toBe("#ff0000");
  });

  test("resolves a chain of references", () => {
    expect(light("var(--a)", { "--a": "var(--b)", "--b": "var(--c)", "--c": "#00ff00" })).toBe("#00ff00");
  });

  test("prefers a declared value over the fallback", () => {
    expect(light("var(--accent, #000000)", { "--accent": "#ff0000" })).toBe("#ff0000");
  });

  test("falls back when the property is not declared", () => {
    expect(light("var(--missing, #0000ff)")).toBe("#0000ff");
  });

  test("throws when the property is not declared and there is no fallback", () => {
    expect(() => light("var(--missing)")).toThrow("`--missing` is not declared");
  });

  test("treats an empty declaration as undeclared", () => {
    expect(light("var(--empty, #0000ff)", { "--empty": "" })).toBe("#0000ff");
    expect(() => light("var(--empty)", { "--empty": "" })).toThrow("`--empty` is not declared");
  });

  test("throws on a cycle, naming the trail", () => {
    expect(() => light("var(--a)", { "--a": "var(--b)", "--b": "var(--a)" })).toThrow(/cycle.*--a.*--b.*--a/s);
  });

  test("throws when a property refers back to itself", () => {
    expect(() => light("var(--color-foreground)")).toThrow("cycle");
  });
});

describe("oklch", () => {
  test("resolves the achromatic ends of the lightness axis", () => {
    expect(light("oklch(0 0 0)")).toBe("#000000");
    expect(light("oklch(1 0 0)")).toBe("#ffffff");
  });

  test("reads a lightness percentage", () => {
    expect(light("oklch(50% 0 0)")).toBe("#636363");
    expect(light("oklch(100% 0 0)")).toBe("#ffffff");
  });

  test("reads a chroma percentage against the 0.4 maximum", () => {
    expect(light("oklch(0.6 50% 30)")).toBe(light("oklch(0.6 0.2 30)"));
    expect(light("oklch(0.6 25% 30)")).toBe(light("oklch(0.6 0.1 30)"));
  });

  test("treats `none` as zero", () => {
    expect(light("oklch(1 none none)")).toBe("#ffffff");
  });

  test("reads a hue in degrees", () => {
    expect(light("oklch(0.6 0.2 30deg)")).toBe(light("oklch(0.6 0.2 30)"));
  });

  test("wraps a hue past a full turn", () => {
    expect(light("oklch(0.6 0.2 390)")).toBe(light("oklch(0.6 0.2 30)"));
  });

  test("clamps the lightness to the range CSS allows", () => {
    expect(light("oklch(2 0 0)")).toBe("#ffffff");
    expect(light("oklch(-1 0 0)")).toBe("#000000");
  });

  test("clamps a negative chroma to zero", () => {
    expect(light("oklch(0.5 -0.1 30)")).toBe(light("oklch(0.5 0 30)"));
  });

  test("throws on a color outside sRGB instead of resolving to a different one", () => {
    expect(() => light("oklch(0.6 0.4 140)")).toThrow("outside sRGB");
    expect(() => light("oklch(0.5 0.3 270)")).toThrow("Reduce the chroma");
  });

  test("names the color it cannot show", () => {
    expect(() => light("oklch(0.6 0.4 140)")).toThrow("`oklch(0.6 0.4 140)`");
  });

  test("resolves a component through a custom property", () => {
    expect(light("oklch(var(--l) 0 0)", { "--l": "1" })).toBe("#ffffff");
  });

  test("throws when a component is missing", () => {
    expect(() => light("oklch(0.5 0)")).toThrow("needs three components");
  });

  test("throws on an alpha channel", () => {
    expect(() => light("oklch(0.5 0 0 / 50%)")).toThrow("Alpha in `oklch()` is not supported");
  });

  test("throws on a percentage hue", () => {
    expect(() => light("oklch(0.5 0 50%)")).toThrow("Percentages are not valid for the hue");
  });

  test("throws on a component that is not a number", () => {
    expect(() => light("oklch(0.5 0 blue)")).toThrow("Cannot read");
  });
});

describe("oklch(from …)", () => {
  const colors = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#353535", "#1e90ff", "#7f3b08"];

  test("returns the origin unchanged when every component is carried over", () => {
    for (const color of colors) {
      expect(light(`oklch(from ${color} l c h)`)).toBe(color);
    }
  });

  test("replaces the component that is given a value", () => {
    expect(light("oklch(from #ff0000 1 0 h)")).toBe("#ffffff");
    expect(light("oklch(from #ff0000 l 0 h)")).toBe(light("oklch(from #ff0000 l none h)"));
  });

  test("dropping the chroma leaves a gray of the same lightness", () => {
    expect(light("oklch(from #1e90ff l 0 h)")).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  // A browser gamut-maps this to black, holding the chroma constant. Only reachable by authoring a color outside sRGB.
  test("throws when the chroma carried over puts a lightness of zero outside sRGB", () => {
    expect(() => light("oklch(from #ff0000 0 c h)")).toThrow("outside sRGB");
  });

  test("resolves an origin that is itself a reference", () => {
    expect(light("oklch(from var(--accent) l c h)", { "--accent": "#1e90ff" })).toBe("#1e90ff");
  });

  test("throws when the origin is missing", () => {
    expect(() => light("oklch(from)")).toThrow("missing its origin color");
  });

  test("throws when a component keyword is used without an origin", () => {
    expect(() => light("oklch(l 0 0)")).toThrow("only meaningful inside `oklch(from …)`");
  });
});

describe("stylesheet parsing", () => {
  test("strips comments before reading the block", () => {
    expect(light("#ffffff", { "--noise": "/* } not the end of :root */ #000000" })).toBe("#ffffff");
  });

  test("reads the value written last when a property is declared twice", () => {
    expect(paletteFrom(`:root { ${REQUIRED_PROPERTIES.map((n) => `${n}: #000000;`).join(" ")} }`).foregroundLight).toBe(
      "#000000",
    );
  });

  test("throws when there is no `:root` block", () => {
    expect(() => paletteFrom("body { color: red; }")).toThrow("No `:root` block");
  });

  test("throws when the `:root` block never closes", () => {
    expect(() => paletteFrom(":root { --color-foreground: #ffffff;")).toThrow("Unterminated");
  });

  test("throws on a color form it cannot resolve", () => {
    expect(() => light("rgb(255 0 0)")).toThrow("Supported forms are");
    expect(() => light("red")).toThrow("Supported forms are");
  });

  test("throws on two calls where one is expected", () => {
    expect(() => light("var(--a) var(--b)", { "--a": "#ffffff", "--b": "#000000" })).toThrow("Supported forms are");
  });
});

describe("readPalette", () => {
  test("resolves every color in the site stylesheet to a canonical hex literal", async () => {
    const palette = await readPalette();

    expect(Object.keys(palette)).toHaveLength(8);

    for (const [name, color] of Object.entries(palette)) {
      expect(color, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("resolves the light and dark schemes to different colors", async () => {
    const palette = await readPalette();

    expect(palette.foregroundLight).not.toBe(palette.foregroundDark);
    expect(palette.backgroundLight).not.toBe(palette.backgroundDark);
  });
});
