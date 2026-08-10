import { beforeEach, describe, expect, test, vi } from "vitest";

import bootOverlayScript from "#/scripts/boot-overlay.ts?inline-script";
import themeScript from "#/scripts/theme.ts?inline-script";

/* These tests run the bundled scripts as the browser receives them, so they cover
 * the plugin, the tree-shaking and minification, and the logic. Attribute names are
 * defined inline and not imported because the stylesheet uses these exact strings. */

function run(script: string) {
  new Function(script)();
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-boot");
});

describe("theme", () => {
  test.for(["light", "dark"])("pins the attribute for %s", (theme) => {
    localStorage.setItem("theme", theme);

    run(themeScript);

    expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
  });

  test.for([
    ["nothing stored", null],
    ["system", "system"],
    ["an unrecognised value", "sepia"],
  ] as const)("leaves the attribute absent for %s", ([, stored]) => {
    if (stored !== null) {
      localStorage.setItem("theme", stored);
    }

    run(themeScript);

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("boot overlay", () => {
  test("covers the desktop on a first visit to the root", () => {
    run(bootOverlayScript);

    expect(document.documentElement.hasAttribute("data-boot")).toBe(true);
  });

  test("stays out of the way once booted", () => {
    sessionStorage.setItem("has-booted", "1");

    run(bootOverlayScript);

    expect(document.documentElement.hasAttribute("data-boot")).toBe(false);
  });
});

describe("resilience", () => {
  test.for([
    ["theme", themeScript, "data-theme"],
    ["boot overlay", bootOverlayScript, "data-boot"],
  ] as const)("the %s script survives storage that throws", ([, script, attribute]) => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied.");
    });

    expect(() => run(script)).not.toThrow();
    expect(document.documentElement.hasAttribute(attribute)).toBe(false);
  });
});
