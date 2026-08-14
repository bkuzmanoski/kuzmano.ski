import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { NOT_FOUND_TITLE } from "#/content/window-registry";
import { newestEntry } from "#/test-utils/content";
import { renderRoute } from "#/test-utils/render-route";

/* These tests use the real route tree to cover route wiring. */

const firstEntry = () => newestEntry("tech-notes");

const openWindows = () => screen.queryAllByRole("region");

/* The focused window renders its title bar controls, so their presence stands in for focus. */
const isFocused = (window: HTMLElement) => within(window).queryByRole("button", { name: "Close" }) !== null;

test("a collection entry route opens a window titled by its frontmatter, holding its compiled MDX body", async () => {
  const entry = firstEntry();
  const { container } = renderRoute(`/tech-notes/${entry.slug}`);

  expect(await screen.findByRole("region", { name: entry.title })).toBeDefined();
  await waitFor(() => expect(container.querySelector("article p")).not.toBeNull());
});

test("a collection route opens a window with the collection title and its entry list", async () => {
  const entry = firstEntry();
  const { history } = renderRoute("/tech-notes");
  const window = await screen.findByRole("region", { name: "Tech Notes" });

  expect(history.location.pathname).toBe("/tech-notes");
  expect(openWindows()).toHaveLength(1);
  expect(within(window).getByRole("link", { name: entry.title }).getAttribute("href")).toBe(
    `/tech-notes/${entry.slug}`,
  );
});

test("a collection entry link opens a new window", async () => {
  const entry = firstEntry();
  const { history } = renderRoute("/tech-notes");
  const window = await screen.findByRole("region", { name: "Tech Notes" });

  fireEvent.click(within(window).getByRole("link", { name: entry.title }));

  await waitFor(() => expect(history.location.pathname).toBe(`/tech-notes/${entry.slug}`));
  expect(history.length).toBe(2);
  expect(openWindows()).toHaveLength(2);
  expect(within(window).getByRole("link", { name: entry.title }).getAttribute("aria-current")).toBe("true");
});

test("closing a collection entry window focuses and updates the state the collection window behind it", async () => {
  const entry = firstEntry();
  const { history } = renderRoute("/tech-notes");
  const collectionWindow = await screen.findByRole("region", { name: "Tech Notes" });

  fireEvent.click(within(collectionWindow).getByRole("link", { name: entry.title }));

  const entryWindow = await screen.findByRole("region", { name: entry.title });

  fireEvent.click(within(entryWindow).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(history.location.pathname).toBe("/tech-notes"));
  await waitFor(() => expect(isFocused(collectionWindow)).toBe(true));
  expect(collectionWindow.querySelector("[aria-current]")).toBeNull();
  expect(openWindows()).toHaveLength(1);
});

test("a second collection reuses the collection window", async () => {
  const { history } = renderRoute("/tech-notes");

  await screen.findByRole("region", { name: "Tech Notes" });
  history.push("/design-notes");

  await screen.findByRole("region", { name: "Design Notes" });
  expect(openWindows()).toHaveLength(1);
});

test("a second unknown path reuses the not-found window", async () => {
  const { history } = renderRoute("/no-such-page");

  await screen.findByRole("region", { name: NOT_FOUND_TITLE });
  history.push("/another-typo");

  await waitFor(() => expect(history.location.pathname).toBe("/another-typo"));
  expect(openWindows()).toHaveLength(1);
});

/* A push would leave an entry that reopens the window as soon as Back reached it,
 * which Chrome defuses by marking the entry skippable (see `syncUrlToFocus`). */
test("the initial window opened by the desktop replaces the desktop in the session history", async () => {
  const { history } = renderRoute("/");

  expect(await screen.findByRole("region", { name: "About" })).toBeDefined();
  expect(history.location.pathname).toBe("/about");
  expect(history.length).toBe(1);
});

test("stepping back and forward over the desktop route follows the window focus both ways", async () => {
  const entry = firstEntry();
  const { history } = renderRoute(`/tech-notes/${entry.slug}`);
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

test("an unknown path under a collection opens a not-found window", async () => {
  renderRoute("/tech-notes/does-not-exist");

  const window = await screen.findByRole("region", { name: NOT_FOUND_TITLE });

  expect(within(window).getByRole("heading", { name: NOT_FOUND_TITLE })).toBeDefined();
});

test("an unknown top-level path opens a not-found window", async () => {
  renderRoute("/no-such-page");

  const window = await screen.findByRole("region", { name: NOT_FOUND_TITLE });

  expect(within(window).getByRole("heading", { name: NOT_FOUND_TITLE })).toBeDefined();
});
