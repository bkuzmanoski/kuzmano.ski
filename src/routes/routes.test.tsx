import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { collections } from "#/content";
import { getRouter } from "#/router";

/**
 * These tests use the real route tree to cover route wiring.
 */

async function renderRoute(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));

  await router.load();

  return render(<RouterProvider router={router} />);
}

function firstPost() {
  const post = collections["tech-notes"]?.list()[0];

  if (!post) {
    throw new Error("this suite expects at least one tech-notes entry");
  }

  return post;
}

test("a post route renders its frontmatter title and compiled MDX body", async () => {
  const post = firstPost();
  const { container } = await renderRoute(`/tech-notes/${post.slug}`);

  expect(await screen.findByRole("heading", { name: post.title })).toBeDefined();
  expect(container.querySelector("article p")).not.toBeNull();
});

test("a collection index lists its posts, linked by slug", async () => {
  const post = firstPost();

  await renderRoute("/tech-notes");

  const link = await screen.findByRole("link", { name: post.title });

  expect(link.getAttribute("href")).toBe(`/tech-notes/${post.slug}`);
});

test("an unknown path under a collection renders not found", async () => {
  await renderRoute("/tech-notes/does-not-exist");
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});

test("an unknown top-level path renders not found", async () => {
  await renderRoute("/no-such-page");
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
});
