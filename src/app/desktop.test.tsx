import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import { FOCUSED_WINDOW_CONTENT_ID } from "#/features/window-manager/window.tsx";
import type * as StartupSequenceLifecycle from "#/lib/startup-sequence/lifecycle.ts";
import { collection, configuredPages } from "#/test-utils/catalog.ts";
import { MOUSE_PRESS_INIT, TOUCH_PRESS_INIT } from "#/test-utils/press.ts";
import { renderRoute } from "#/test-utils/router.tsx";

const startupSequence = vi.hoisted(() => ({ isComplete: true, listeners: new Set<() => void>() }));

vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).configuredCatalogMock());
vi.mock("#/lib/startup-sequence/lifecycle.ts", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    startupSequence.listeners.add(listener);
    return () => startupSequence.listeners.delete(listener);
  };

  return {
    ...(await importOriginal<typeof StartupSequenceLifecycle>()),
    useIsStartupSequenceComplete: () => useSyncExternalStore(subscribe, () => startupSequence.isComplete),
  };
});
vi.mock("#/features/startup-sequence/startup-sequence.tsx", () => ({ StartupSequence: () => null }));

beforeEach(() => {
  startupSequence.isComplete = true;
});

function completeStartupSequence() {
  startupSequence.isComplete = true;

  for (const listener of startupSequence.listeners) {
    listener();
  }
}

const INITIAL_PAGE_TITLE = configuredPages[INITIAL_WINDOW_ROUTE.slice(1)]!.title;

const menuBarNavigation = () => screen.findByRole("navigation", { name: "Main menu", hidden: true });

test("the desktop is inert while the startup sequence covers it", async () => {
  startupSequence.isComplete = false;
  renderRoute(collection.route);

  expect((await menuBarNavigation()).closest("[inert]")).not.toBeNull();
});

test("the desktop is not inert once the startup sequence has completed", async () => {
  renderRoute(collection.route);
  expect((await menuBarNavigation()).closest("[inert]")).toBeNull();
});

test("the initial window takes the focus once the startup sequence has completed", async () => {
  startupSequence.isComplete = false;
  renderRoute("/");

  const window = await screen.findByRole("region", { name: INITIAL_PAGE_TITLE });

  expect(document.activeElement).not.toBe(window);

  act(completeStartupSequence);

  expect(document.activeElement).toBe(window);
});

test("the skip link focuses the focused window's content", async () => {
  renderRoute("/");
  await screen.findByRole("region", { name: INITIAL_PAGE_TITLE });
  fireEvent.click(screen.getByRole("link", { name: "Jump to content" }));

  expect(document.activeElement).toBe(document.getElementById(FOCUSED_WINDOW_CONTENT_ID));
});

test("a mouse press focuses the desktop on its `pointerdown` event", async () => {
  const { history } = renderRoute(collection.route);

  await menuBarNavigation();
  fireEvent.pointerDown(screen.getByRole("main"), MOUSE_PRESS_INIT);

  expect(history.location.pathname).toBe("/");
});

test("a tap focuses the desktop on its `click` event, not its `pointerdown` event, and a canceled touch does not focus it", async () => {
  const { history } = renderRoute(collection.route);

  await menuBarNavigation();

  const desktop = screen.getByRole("main");

  fireEvent.pointerDown(desktop, TOUCH_PRESS_INIT);
  fireEvent.pointerCancel(desktop, TOUCH_PRESS_INIT);
  fireEvent.click(desktop, { detail: 1 });

  expect(history.location.pathname).toBe(collection.route);

  fireEvent.pointerDown(desktop, TOUCH_PRESS_INIT);

  expect(history.location.pathname).toBe(collection.route);

  fireEvent.click(desktop, { detail: 1 });

  expect(history.location.pathname).toBe("/");
});
