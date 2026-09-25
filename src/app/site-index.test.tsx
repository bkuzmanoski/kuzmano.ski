import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { DESTINATION_ORDER } from "#/config/navigation.ts";
import { DESTINATIONS } from "#/site/navigation.ts";

import { SiteIndex } from "./site-index.tsx";

test("the site index has the `inert` attribute and links to the route of every destination", () => {
  const { container } = render(<SiteIndex />);
  const siteIndex = container.querySelector("nav")!;

  expect(siteIndex.hasAttribute("inert")).toBe(true);
  expect([...siteIndex.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(
    DESTINATION_ORDER.map((id) => DESTINATIONS[id].route),
  );
});
