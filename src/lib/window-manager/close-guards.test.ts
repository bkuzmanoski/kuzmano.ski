import { beforeEach, describe, expect, test } from "vitest";

import { createCloseGuards } from "./close-guards.ts";

import type { CloseGuards } from "./close-guards.ts";

describe("close guards", () => {
  let guards: CloseGuards;

  beforeEach(() => {
    guards = createCloseGuards();
  });

  test("a close request for a window without a guard is not claimed", () => {
    expect(guards.claim("entry")).toBe(false);
  });

  test("a guard only claims close requests for its own window", () => {
    const unregister = guards.register("contact", () => true);

    expect(guards.claim("contact")).toBe(true);
    expect(guards.claim("entry")).toBe(false);

    unregister();

    expect(guards.claim("contact")).toBe(false);
  });

  test("a guard that returns `false` does not claim the close request", () => {
    guards.register("contact", () => false);
    expect(guards.claim("contact")).toBe(false);
  });

  test("unregistering a replaced guard does not unregister its replacement", () => {
    const unregisterFirst = guards.register("contact", () => false);

    guards.register("contact", () => true);
    unregisterFirst();

    expect(guards.claim("contact")).toBe(true);
  });
});
