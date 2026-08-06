import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { collections } from "#/content";
import { getRouter } from "#/router";

/* These tests use the real route tree to cover route wiring. */

async function renderRoute(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = getRouter(history);

  await router.load();

  return { history, ...render(<RouterProvider router={router} />) };
}

function firstPost() {
  const post = collections["tech-notes"]?.list()[0];

  if (!post) {
    throw new Error("This suite expects at least one tech-notes entry.");
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

/* A push would leave an entry that reopens the window as soon as Back reached it,
 * which Chrome defuses by marking the entry skippable (see `syncUrlToFocus`). */
test("the initial window opened by the desktop replaces the desktop in the session history", async () => {
  const { history } = await renderRoute("/");

  expect(await screen.findByRole("region", { name: "About" })).toBeDefined();
  expect(history.location.pathname).toBe("/about");
  expect(history.length).toBe(1);
});

test("an unknown path under a collection opens a 404 window", async () => {
  await renderRoute("/tech-notes/does-not-exist");

  const window = await screen.findByRole("region", { name: "404" });

  expect(within(window).getByRole("heading", { name: "Page not found (404)" })).toBeDefined();
});

test("an unknown top-level path opens a 404 window", async () => {
  await renderRoute("/no-such-page");

  const window = await screen.findByRole("region", { name: "404" });

  expect(within(window).getByRole("heading", { name: "Page not found (404)" })).toBeDefined();
});
