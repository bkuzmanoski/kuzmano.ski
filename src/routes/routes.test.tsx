import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { getRouter } from "#/router";

async function renderRoute(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));

  await router.load();
  render(<RouterProvider router={router} />);
}

test("a post route renders its frontmatter and compiled MDX body", async () => {
  await renderRoute("/writing/hello-world");

  expect(await screen.findByRole("heading", { name: "Hello World" })).toBeDefined();
  expect(await screen.findByText(/This file is MDX/)).toBeDefined();
});

test("a post route renders a code block from the MDX body", async () => {
  await renderRoute("/writing/hello-world");

  expect(await screen.findByText(/Hello from a prerendered page/)).toBeDefined();
});

test("a collection index lists its posts, linked by slug", async () => {
  await renderRoute("/writing");

  const link = await screen.findByRole("link", { name: "Hello World" });

  expect(link.getAttribute("href")).toBe("/writing/hello-world");
});

test("an unknown path under a collection renders not found", async () => {
  await renderRoute("/writing/does-not-exist");

  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});

test("an unknown top-level path renders not found", async () => {
  await renderRoute("/no-such-page");

  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});
