import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { collections } from "#/content";
import { renderRoute } from "#/test-utils/render-route";

/* These tests use the real route tree to cover route wiring. */

function firstEntry() {
  const entry = collections["tech-notes"]?.list()[0];

  if (!entry) {
    throw new Error("This suite expects at least one tech-notes entry.");
  }

  return entry;
}

const openWindows = () => screen.queryAllByRole("region");

test("a collection entry route renders its frontmatter title and compiled MDX body", async () => {
  const entry = firstEntry();
  const { container } = await renderRoute(`/tech-notes/${entry.slug}`);

  expect(await screen.findByRole("heading", { name: entry.title })).toBeDefined();
  expect(container.querySelector("article p")).not.toBeNull();
});

test("a collection index lists its entries, linked by slug", async () => {
  const entry = firstEntry();

  await renderRoute("/tech-notes");

  const link = await screen.findByRole("link", { name: entry.title });

  expect(link.getAttribute("href")).toBe(`/tech-notes/${entry.slug}`);
});

test("a collection index opens on its most recent entry", async () => {
  const entry = firstEntry();
  const { history } = await renderRoute("/tech-notes");

  expect(await screen.findByRole("region", { name: entry.title })).toBeDefined();
  await waitFor(() => expect(history.location.pathname).toBe(`/tech-notes/${entry.slug}`));
});

test("a second collection reuses the collection window", async () => {
  const { history } = await renderRoute("/tech-notes");

  await screen.findByRole("region", { name: firstEntry().title });
  history.push("/design-notes");

  await waitFor(() => expect(openWindows()).toHaveLength(1));
});

test("a second unknown path reuses the 404 window", async () => {
  const { history } = await renderRoute("/no-such-page");

  await screen.findByRole("region", { name: "Page not found (404)" });
  history.push("/another-typo");

  await waitFor(() => expect(history.location.pathname).toBe("/another-typo"));
  expect(openWindows()).toHaveLength(1);
});

/* A push would leave an entry that reopens the window as soon as Back reached it,
 * which Chrome defuses by marking the entry skippable (see `syncUrlToFocus`). */
test("the initial window opened by the desktop replaces the desktop in the session history", async () => {
  const { history } = await renderRoute("/");

  expect(await screen.findByRole("region", { name: "About" })).toBeDefined();
  expect(history.location.pathname).toBe("/about");
  expect(history.length).toBe(1);
});

/* The focused window renders its title bar controls, so their presence stands in for focus. */
const isFocused = (window: HTMLElement) => within(window).queryByRole("button", { name: "Close" }) !== null;

test("stepping back and forward over the desktop route follows the window focus both ways", async () => {
  const entry = firstEntry();
  const { history } = await renderRoute(`/tech-notes/${entry.slug}`);
  const window = await screen.findByRole("region", { name: entry.title });

  history.push("/"); // A click on the desktop unfocuses the window and pushes "/".

  await waitFor(() => expect(isFocused(window)).toBe(false));

  history.back();

  await waitFor(() => expect(isFocused(window)).toBe(true));
  expect(history.location.pathname).toBe(`/tech-notes/${entry.slug}`);

  history.forward();

  await waitFor(() => expect(isFocused(window)).toBe(false));
  expect(history.location.pathname).toBe("/");
});

test("an unknown path under a collection opens a 404 window", async () => {
  await renderRoute("/tech-notes/does-not-exist");

  const window = await screen.findByRole("region", { name: "Page not found (404)" });

  expect(within(window).getByRole("heading", { name: "Page not found (404)" })).toBeDefined();
});

test("an unknown top-level path opens a 404 window", async () => {
  await renderRoute("/no-such-page");

  const window = await screen.findByRole("region", { name: "Page not found (404)" });

  expect(within(window).getByRole("heading", { name: "Page not found (404)" })).toBeDefined();
});
