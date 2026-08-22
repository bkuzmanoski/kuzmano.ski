import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { NOT_FOUND_PAGE_TITLE } from "#/config/site";
import { newestEntry } from "#/test-utils/content";
import { renderRoute } from "#/test-utils/router";

// These tests use the real route tree to cover route wiring.

const firstEntry = () => newestEntry("tech-notes");
const openWindows = () => screen.queryAllByRole("region");
const isFocused = (window: HTMLElement) => within(window).queryByRole("button", { name: "Close" }) !== null; // The focused window renders its title bar controls, so their presence stands in for focus.

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

test("a new unknown path replaces the current not-found dialog", async () => {
  const { history } = renderRoute("/no-such-page");

  await screen.findByRole("dialog", { name: NOT_FOUND_PAGE_TITLE });
  history.push("/another-typo");

  await waitFor(() => expect(history.location.pathname).toBe("/another-typo"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(openWindows()).toHaveLength(0);
});

// A push would leave an entry that reopens the window as soon as Back reached it,
// which Chrome defuses by marking the entry skippable (see `syncUrlToFocus`).
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

test("an unknown path opens the not-found dialog instead of a window", async () => {
  renderRoute("/no-such-page");

  expect(await screen.findByRole("dialog", { name: NOT_FOUND_PAGE_TITLE })).toBeDefined();
  expect(openWindows()).toHaveLength(0);
});

test("an unknown entry in a collection opens the not-found dialog", async () => {
  renderRoute("/tech-notes/does-not-exist");
  expect(await screen.findByRole("dialog", { name: NOT_FOUND_PAGE_TITLE })).toBeDefined();
});

test("dismissing a deep-linked not-found dialog returns to the desktop", async () => {
  const { history } = renderRoute("/no-such-page");

  fireEvent.click(await screen.findByRole("button", { name: "OK" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(openWindows()).toHaveLength(0);
});

test("dismissing a not-found dialog reached from a window returns to that window", async () => {
  const { history } = renderRoute("/tech-notes");
  const window = await screen.findByRole("region", { name: "Tech Notes" });

  history.push("/no-such-page");
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));

  await waitFor(() => expect(history.location.pathname).toBe("/tech-notes"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(isFocused(window)).toBe(true);
  expect(openWindows()).toHaveLength(1);
});

test("the contact route opens a compose window rather than resolving a document", async () => {
  const { history } = renderRoute("/contact");
  const window = await screen.findByRole("region", { name: "Contact" });

  expect(history.location.pathname).toBe("/contact");
  expect(openWindows()).toHaveLength(1);
  expect(within(window).getByLabelText("From:")).toBeDefined();
  expect(within(window).getByLabelText("Message:")).toBeDefined();
});

test("closing the contact window with an unsent message prompts for confirmation", async () => {
  renderRoute("/contact");

  const window = await screen.findByRole("region", { name: "Contact" });

  fireEvent.change(within(window).getByLabelText("Message:"), { target: { value: "Hello." } });
  fireEvent.click(within(window).getByRole("button", { name: "Close" }));

  const alert = await screen.findByRole("dialog");

  expect(within(alert).getByText("Discard this message?")).toBeDefined();
  expect(openWindows()).toHaveLength(1);

  fireEvent.click(within(alert).getByRole("button", { name: "Discard" }));

  await waitFor(() => expect(openWindows()).toHaveLength(0));
});

test("closing the contact window with no message closes without prompting", async () => {
  renderRoute("/contact");

  const window = await screen.findByRole("region", { name: "Contact" });

  fireEvent.click(within(window).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(openWindows()).toHaveLength(0));
  expect(screen.queryByRole("dialog")).toBeNull();
});
