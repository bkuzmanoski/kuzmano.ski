import { describe, expect, test } from "vitest";

import { CONTACT_ROUTE } from "#/config/contact.ts";

import { RESERVED_ROUTES, reservedRouteFor } from "./content-routes.ts";

// The content URL shape this module re-exports is tested in `/src/lib/content/paths.test.ts`.

describe("reserved routes", () => {
  // A window, not a content file, serves `/contact`, so content of the same name would shadow it.
  test("the contact route is reserved", () => {
    expect(RESERVED_ROUTES).toContain(CONTACT_ROUTE);
  });

  test("looking up a segment that would shadow a reserved route returns that route", () => {
    expect(reservedRouteFor(CONTACT_ROUTE.slice(1))).toBe(CONTACT_ROUTE);
  });

  test("looking up a segment that shadows no reserved route returns undefined", () => {
    expect(reservedRouteFor("blog")).toBeUndefined();
  });
});
