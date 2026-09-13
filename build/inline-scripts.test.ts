import { beforeEach, expect, test } from "vitest";

import inlineScript from "./test-utils/inline-script-entry.ts?inline-script";

function run(script: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- Tests the bundle as it would be evaluated in the browser.
  new Function(script)();
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-inline-script-mode");
  document.documentElement.removeAttribute("data-inline-script-dev");
  document.documentElement.removeAttribute("data-inline-script-character");
});

test("a script reading `import.meta.env` is bundled with the values Vite resolved for the parent config", () => {
  run(inlineScript);

  // Compare with this module's Vite-replaced `import.meta.env` to ensure the bundle uses the app's resolved values rather than a separate copy.
  expect(document.documentElement.dataset.inlineScriptMode).toBe(import.meta.env.MODE);
  expect(document.documentElement.dataset.inlineScriptDev).toBe(String(import.meta.env.DEV));
});

test("a script reading `import.meta.env` has no `import.meta` left in its bundle", () => {
  expect(inlineScript).not.toContain("import.meta"); // `import.meta` is empty in an IIFE bundle, so an unresolved access such as would throw before the script can update the document head.
});

test("a non-ASCII character is preserved in the bundle", () => {
  run(inlineScript);

  expect(inlineScript).toContain("✓");
  expect(document.documentElement.dataset.inlineScriptCharacter).toBe("✓");
});
