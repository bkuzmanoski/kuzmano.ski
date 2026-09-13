import { expect, test } from "vitest";

import { getRouter } from "./router.tsx";

test("`getRouter` builds a router from the generated route tree, with scroll restoration and preloading on intent", () => {
  const router = getRouter();

  expect(router.routesByPath["/"]).toBeDefined();
  expect(router.options.scrollRestoration).toBe(true);
  expect(router.options.defaultPreload).toBe("intent");
});
