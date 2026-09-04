import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import { NOT_FOUND_DOCUMENT_TITLE } from "#/config/site.ts";
import { configuredCollections, configuredPages, otherCollection } from "#/test-utils/catalog.ts";
import { renderRoute } from "#/test-utils/router.tsx";

// These tests use the real route tree to cover route wiring.

vi.mock("#/site/catalog.ts", async () => {
  const catalog = await import("#/test-utils/catalog.ts");

  return catalog.configuredCatalogMock({
    collections: { ...catalog.configuredCollections, "other-collection": catalog.otherCollection },
  });
});

const [collection] = Object.values(configuredCollections);
const initialPage = configuredPages[INITIAL_WINDOW_ROUTE.slice(1)];

if (!collection || !initialPage) {
  throw new Error("This suite expects a configured collection and a configured page at the initial window route.");
}

const collectionEntry = collection.list()[0]!;
const collectionEntryRoute = collection.routeOf(collectionEntry.slug);

const openWindows = () => screen.queryAllByRole("region");
const isFocused = (window: HTMLElement) => within(window).queryByRole("button", { name: "Close" }) !== null; // Title bar controls are rendered only for the focused window.

test("a collection entry route opens a window titled by its frontmatter, holding its compiled MDX body", async () => {
  const { container } = renderRoute(collectionEntryRoute);

  expect(await screen.findByRole("region", { name: collectionEntry.title })).toBeDefined();
  await waitFor(() => expect(container.querySelector("article p")).not.toBeNull());
});

test("a collection route opens a window with the collection title and its entry list", async () => {
  const { history } = renderRoute(collection.route);
  const window = await screen.findByRole("region", { name: collection.title });

  expect(history.location.pathname).toBe(collection.route);
  expect(openWindows()).toHaveLength(1);
  expect(within(window).getByRole("link", { name: collectionEntry.title }).getAttribute("href")).toBe(
    collectionEntryRoute,
  );
});

test("a collection entry link opens a new window", async () => {
  const { history } = renderRoute(collection.route);
  const window = await screen.findByRole("region", { name: collection.title });

  fireEvent.click(within(window).getByRole("link", { name: collectionEntry.title }));

  await waitFor(() => expect(history.location.pathname).toBe(collectionEntryRoute));
  expect(history.length).toBe(2);
  expect(openWindows()).toHaveLength(2);
  expect(within(window).getByRole("link", { name: collectionEntry.title }).getAttribute("aria-current")).toBe("true");
});

test("closing a collection entry window focuses and updates the state the collection window behind it", async () => {
  const { history } = renderRoute(collection.route);
  const collectionWindow = await screen.findByRole("region", { name: collection.title });

  fireEvent.click(within(collectionWindow).getByRole("link", { name: collectionEntry.title }));

  const entryWindow = await screen.findByRole("region", { name: collectionEntry.title });

  fireEvent.click(within(entryWindow).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(history.location.pathname).toBe(collection.route));
  await waitFor(() => expect(isFocused(collectionWindow)).toBe(true));
  expect(collectionWindow.querySelector("[aria-current]")).toBeNull();
  expect(openWindows()).toHaveLength(1);
});

test("a second collection reuses the collection window", async () => {
  const { history } = renderRoute(collection.route);

  await screen.findByRole("region", { name: collection.title });
  history.push(otherCollection.route);

  await screen.findByRole("region", { name: otherCollection.title });
  expect(openWindows()).toHaveLength(1);
});

test("a new unknown path replaces the current not-found alert", async () => {
  const { history } = renderRoute("/no-such-page");

  await screen.findByRole("dialog", { name: NOT_FOUND_DOCUMENT_TITLE });
  history.push("/another-typo");

  await waitFor(() => expect(history.location.pathname).toBe("/another-typo"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(openWindows()).toHaveLength(0);
});

// A push would leave an entry that reopens the window as soon as Back reached it,
// which Chrome defuses by marking the entry skippable (see `syncUrlToFocus`).
test("the initial window opened by the desktop replaces the desktop in the session history", async () => {
  const { history } = renderRoute("/");

  expect(await screen.findByRole("region", { name: initialPage.title })).toBeDefined();
  expect(history.location.pathname).toBe(INITIAL_WINDOW_ROUTE);
  expect(history.length).toBe(1);
});

test("stepping back and forward over the desktop route follows the window focus both ways", async () => {
  const { history } = renderRoute(collectionEntryRoute);
  const window = await screen.findByRole("region", { name: collectionEntry.title });

  history.push("/"); // A click on the desktop unfocuses the window and pushes "/".

  await waitFor(() => expect(isFocused(window)).toBe(false));

  history.back();

  await waitFor(() => expect(isFocused(window)).toBe(true));
  expect(history.location.pathname).toBe(collectionEntryRoute);

  history.forward();

  await waitFor(() => expect(isFocused(window)).toBe(false));
  expect(history.location.pathname).toBe("/");
});

test("an unknown path opens the not-found dialog instead of a window", async () => {
  renderRoute("/no-such-page");

  expect(await screen.findByRole("dialog", { name: NOT_FOUND_DOCUMENT_TITLE })).toBeDefined();
  expect(openWindows()).toHaveLength(0);
});

test("an unknown entry in a collection opens the not-found dialog", async () => {
  renderRoute(collection.routeOf("does-not-exist"));
  expect(await screen.findByRole("dialog", { name: NOT_FOUND_DOCUMENT_TITLE })).toBeDefined();
});

test("dismissing a deep-linked not-found alert returns to the desktop", async () => {
  const { history } = renderRoute("/no-such-page");

  fireEvent.click(await screen.findByRole("button", { name: "OK" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(openWindows()).toHaveLength(0);
});

test("dismissing a not-found alert reached from a window returns to that window", async () => {
  const { history } = renderRoute(collection.route);
  const window = await screen.findByRole("region", { name: collection.title });

  history.push("/no-such-page");
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));

  await waitFor(() => expect(history.location.pathname).toBe(collection.route));
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
