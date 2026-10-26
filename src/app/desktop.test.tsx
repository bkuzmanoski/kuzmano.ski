import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import type * as StartupSequenceLifecycle from "#/lib/startup-sequence/lifecycle.ts";
import { collection, configuredPages } from "#/test-utils/catalog.ts";
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

  const window = await screen.findByRole("region", { name: configuredPages[INITIAL_WINDOW_ROUTE.slice(1)]!.title });

  expect(document.activeElement).not.toBe(window);

  act(completeStartupSequence);

  expect(document.activeElement).toBe(window);
});
