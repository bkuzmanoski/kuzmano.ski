import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { RouterContext } from "#/test-utils/router-context.tsx";

import { ContentLink, OpensInNewTabDescriptionProvider } from "./content-link.tsx";

test("a link to a path on this site does not have the `target` attribute", () => {
  render(<ContentLink href="/collection/entry">Fixture link</ContentLink>, { wrapper: RouterContext });

  const link = screen.getByRole("link", { name: "Fixture link" });

  expect(link.getAttribute("href")).toBe("/collection/entry");
  expect(link.hasAttribute("target")).toBe(false);
});

test("hovering a link to a path with a query string and a fragment preloads the route its pathname matches, with the parameters of its pathname", async () => {
  const loadEntry = vi.fn();
  const rootRoute = createRootRoute();
  const entryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/collection/$slug", loader: loadEntry });
  const router = createRouter({
    routeTree: rootRoute.addChildren([entryRoute]),
    history: createMemoryHistory(),
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
  });

  render(
    <RouterContextProvider router={router}>
      <ContentLink href="/collection/entry?page=2#section">Fixture link</ContentLink>
    </RouterContextProvider>,
  );

  const link = screen.getByRole("link", { name: "Fixture link" });

  expect(link.getAttribute("href")).toBe("/collection/entry?page=2#section");

  fireEvent.mouseEnter(link);

  await waitFor(() => expect(loadEntry).toHaveBeenCalledOnce());
  expect(loadEntry).toHaveBeenCalledWith(expect.objectContaining({ params: { slug: "entry" } }));
});

test.each([
  ["an absolute URL", "https://example.com/path"],
  ["a protocol-relative URL", "//example.com/path"],
  ["a path whose second character is a backslash", String.raw`/\example.com/path`],
])("a link to %s has the `target` attribute `_blank` and does not have the `rel` attribute", (_label, href) => {
  render(<ContentLink href={href}>Fixture link</ContentLink>, { wrapper: RouterContext });

  const link = screen.getByRole("link", { name: "Fixture link" });

  expect(link.getAttribute("href")).toBe(href);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.hasAttribute("rel")).toBe(false);
});

test("a link to a fragment does not have the `target` attribute", () => {
  render(<ContentLink href="#section">Fixture link</ContentLink>, { wrapper: RouterContext });

  const link = screen.getByRole("link", { name: "Fixture link" });

  expect(link.getAttribute("href")).toBe("#section");
  expect(link.hasAttribute("target")).toBe(false);
});

test("a link to another site in an entry is described as opening in a new tab", () => {
  render(
    <OpensInNewTabDescriptionProvider>
      <ContentLink href="https://example.com/path">Fixture link</ContentLink>
    </OpensInNewTabDescriptionProvider>,
    { wrapper: RouterContext },
  );
  expect(screen.getByRole("link", { name: "Fixture link", description: "Opens in a new tab" })).toBeDefined();
});

test("a link to another site outside an entry does not have the `aria-describedby` attribute", () => {
  render(<ContentLink href="https://example.com/path">Fixture link</ContentLink>, { wrapper: RouterContext });
  expect(screen.getByRole("link", { name: "Fixture link" }).hasAttribute("aria-describedby")).toBe(false);
});

test.each([
  ["a `mailto:` URL", "mailto:name@example.com"],
  ["a `tel:` URL", "tel:+61200000000"],
])(
  "a link to %s in an entry does not have the `target` attribute or the `aria-describedby` attribute",
  (_label, href) => {
    render(
      <OpensInNewTabDescriptionProvider>
        <ContentLink href={href}>Fixture link</ContentLink>
      </OpensInNewTabDescriptionProvider>,
      { wrapper: RouterContext },
    );

    const link = screen.getByRole("link", { name: "Fixture link" });

    expect(link.getAttribute("href")).toBe(href);
    expect(link.hasAttribute("target")).toBe(false);
    expect(link.hasAttribute("aria-describedby")).toBe(false);
  },
);
