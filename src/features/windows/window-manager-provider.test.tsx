import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { CONTACT_ROUTE } from "#/config/contact.ts";
import { LAYOUT } from "#/config/desktop.ts";
import {
  useFocusedWindow,
  useNotFoundRoute,
  useWindowActions,
  useWindowContent,
} from "#/lib/window-manager/context.ts";
import type { WindowActions } from "#/lib/window-manager/context.ts";
import type { WindowContent, WindowId, WindowRecord } from "#/lib/window-manager/window.ts";
import type * as SiteWindows from "#/site/windows.ts";
import { collection, collectionEntries } from "#/test-utils/catalog.ts";

import { WindowManagerProvider } from "./window-manager-provider.tsx";

import type { RouterHistory } from "@tanstack/react-router";

// `routes.test.ts` covers the two effects below through the real route tree. This suite renders the
// provider over a route tree whose components render `null`, so each effect can be asserted without a
// document, window, or content body. The catalog is faked because `resolveRoute` reads it;
// `resolveRoute` itself stays real, wrapped in a spy so one test can count the calls to it.
vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());

const resolveRoute = vi.hoisted(() => vi.fn());

vi.mock("#/site/windows.ts", async (importOriginal) => {
  const windows = await importOriginal<typeof SiteWindows>();

  resolveRoute.mockImplementation(windows.resolveRoute);

  return { ...windows, resolveRoute };
});

const DESKTOP_ROUTE = "/";
const ENTRY_ROUTE = collection.routeOf(collectionEntries[0]!.slug);
const COLLECTION_ROUTE = collection.route;
const UNKNOWN_ROUTE = "/no-such-page";

let windowActions: WindowActions | null = null;
let openWindows: WindowRecord<WindowContent>;
let focusedWindow: WindowId | null;
let notFoundRoute: string | null;

// Recorded in an effect so every assertion reads the state of the provider's latest commit.
function Probe() {
  const actions = useWindowActions();
  const content = useWindowContent();
  const focused = useFocusedWindow();
  const missingRoute = useNotFoundRoute();

  useEffect(() => {
    windowActions = actions;
    openWindows = content;
    focusedWindow = focused;
    notFoundRoute = missingRoute;
  });

  return null;
}

async function renderProvider(route: string, initialRoute?: string) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const rootRoute = createRootRoute({
    component: () => (
      <WindowManagerProvider layout={LAYOUT} initialRoute={initialRoute}>
        <Probe />
      </WindowManagerProvider>
    ),
  });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null }),
    createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => null }), // Matches every other path, so the router does not render a not-found component of its own.
  ]);

  render(<RouterProvider router={createRouter({ routeTree, history })} />);

  await waitFor(() => expect(windowActions).not.toBeNull());

  return history;
}

const actions = () => windowActions!;
const openRoutes = () => Object.values(openWindows).map((window) => window.route);
const focusedRoute = () => (focusedWindow === null ? null : (openWindows[focusedWindow]?.route ?? null));

const settle = (route: string, history: RouterHistory) => waitFor(() => expect(history.location.pathname).toBe(route));

beforeEach(() => {
  windowActions = null;
  openWindows = {};
  focusedWindow = null;
  notFoundRoute = null;
});

test("a deep-linked route opens its window without adding a session history entry", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));
  expect(focusedRoute()).toBe(ENTRY_ROUTE);
  expect(history.length).toBe(1);
});

test("focusing a window pushes its route onto the session history", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  act(() => actions().open(COLLECTION_ROUTE));
  await settle(COLLECTION_ROUTE, history);

  act(() => actions().focus("entry"));
  await settle(ENTRY_ROUTE, history);

  expect(history.length).toBe(3);
});

test("an external URL change opens the window the route addresses", async () => {
  const history = await renderProvider(DESKTOP_ROUTE);

  history.push(COLLECTION_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("collection"));
  expect(focusedRoute()).toBe(COLLECTION_ROUTE);
  expect(history.location.pathname).toBe(COLLECTION_ROUTE);
});

test("an external URL change focuses an open window rather than opening a second", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  act(() => actions().open(CONTACT_ROUTE));
  await waitFor(() => expect(focusedWindow).toBe("contact"));

  history.push(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));
  expect(openRoutes()).toHaveLength(2);
});

test("an external change to the desktop route unfocuses the open window without closing it", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  history.push(DESKTOP_ROUTE);

  await waitFor(() => expect(focusedWindow).toBeNull());
  expect(openRoutes()).toEqual([ENTRY_ROUTE]);
});

// The provider's own navigation arrives back as a URL change. `expectedRouteRef` records the route it
// navigated to, so the URL-to-focus effect skips that one; without it, every internal navigation would
// be resolved a second time and dispatched back into the state it came from.
test("the URL the provider navigated to itself is not resolved a second time", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  act(() => actions().open(COLLECTION_ROUTE));
  await settle(COLLECTION_ROUTE, history);

  resolveRoute.mockClear();

  act(() => actions().focus("entry"));
  await settle(ENTRY_ROUTE, history);

  expect(resolveRoute).not.toHaveBeenCalled();
  expect(openRoutes()).toHaveLength(2);
});

test("opening a window with `replaceUrl` leaves the previous route out of the session history", async () => {
  const history = await renderProvider(DESKTOP_ROUTE);

  act(() => actions().open(COLLECTION_ROUTE, { replaceUrl: true }));
  await settle(COLLECTION_ROUTE, history);

  expect(history.length).toBe(1);
});

test("opening a window without `replaceUrl` keeps the previous route in the session history", async () => {
  const history = await renderProvider(DESKTOP_ROUTE);

  act(() => actions().open(COLLECTION_ROUTE));
  await settle(COLLECTION_ROUTE, history);

  expect(history.length).toBe(2);
});

test("the initial route replaces the desktop route in the session history", async () => {
  const history = await renderProvider(DESKTOP_ROUTE, COLLECTION_ROUTE);

  await settle(COLLECTION_ROUTE, history);

  expect(focusedWindow).toBe("collection");
  expect(history.length).toBe(1);
});

test("an unknown path is reported as not found, and its URL is left in place until the alert is dismissed", async () => {
  const history = await renderProvider(COLLECTION_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("collection"));

  history.push(UNKNOWN_ROUTE);

  await waitFor(() => expect(notFoundRoute).toBe(UNKNOWN_ROUTE));
  expect(history.location.pathname).toBe(UNKNOWN_ROUTE); // Left in place, though the collection window is still the focused one.

  act(() => actions().dismissNotFound());
  await settle(COLLECTION_ROUTE, history);

  expect(notFoundRoute).toBeNull();
  expect(focusedWindow).toBe("collection");
});

test("closing the last open window returns to the desktop route", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  act(() => actions().close("entry"));
  await settle(DESKTOP_ROUTE, history);

  expect(openRoutes()).toEqual([]);
  expect(focusedWindow).toBeNull();
});

test("closing the focused window returns to the route of the window beneath it", async () => {
  const history = await renderProvider(ENTRY_ROUTE);

  await waitFor(() => expect(focusedWindow).toBe("entry"));

  act(() => actions().open(COLLECTION_ROUTE));
  await settle(COLLECTION_ROUTE, history);
  act(() => actions().close("collection"));
  await settle(ENTRY_ROUTE, history);

  expect(focusedWindow).toBe("entry");
});
