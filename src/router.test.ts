import { expect, test } from "vitest";

import { getRouter } from "./router.tsx";

test("`getRouter` builds a router from the generated route tree that preloads on intent and leaves scroll positions to the windows", () => {
  const router = getRouter();

  expect(router.routesByPath["/"]).toBeDefined();
  expect(router.options.scrollRestoration).toBe(false);
  expect(router.options.defaultPreload).toBe("intent");
});
