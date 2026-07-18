import { expect, test } from "vitest";

import { getRouter } from "./router";

test("builds a router with the generated route tree", () => {
  const router = getRouter();

  expect(router.routesByPath["/"]).toBeDefined();
  expect(router.options.scrollRestoration).toBe(true);
  expect(router.options.defaultPreload).toBe("intent");
});
