import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { writing } from "#/content";
import { getRouter } from "#/router";

/**
 * These tests drive the real route tree so the assertions cover the wiring as a
 * post that renders in isolation can still break when its MDX module is resolved
 * through a path that only works if a loader ran first.
 *
 * Expectations are read from the content collection.
 */

async function renderRoute(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));

  await router.load();

  return render(<RouterProvider router={router} />);
}

async function firstPost() {
  const [post] = await writing.list();

  if (!post) {
    throw new Error("this suite expects at least one writing entry");
  }

  return post;
}

test("a post route renders its frontmatter title and compiled MDX body", async () => {
  const post = await firstPost();
  const { container } = await renderRoute(`/writing/${post.slug}`);

  expect(await screen.findByRole("heading", { name: post.title })).toBeDefined();
  expect(container.querySelector("article p")).not.toBeNull();
});

test("a collection index lists its posts, linked by slug", async () => {
  const post = await firstPost();

  await renderRoute("/writing");

  const link = await screen.findByRole("link", { name: post.title });

  expect(link.getAttribute("href")).toBe(`/writing/${post.slug}`);
});

test("an unknown path under a collection renders not found", async () => {
  await renderRoute("/writing/does-not-exist");
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});

test("an unknown top-level path renders not found", async () => {
  await renderRoute("/no-such-page");
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});
