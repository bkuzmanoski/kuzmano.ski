import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { INITIAL_WINDOW_ROUTE } from "#/config/navigation.ts";
import type * as BootSequenceLifecycle from "#/lib/boot-sequence/lifecycle.ts";
import { collection, configuredPages } from "#/test-utils/catalog.ts";
import { renderRoute } from "#/test-utils/router.tsx";

const bootSequence = vi.hoisted(() => ({ isComplete: true, listeners: new Set<() => void>() }));

vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).configuredCatalogMock());
vi.mock("#/lib/boot-sequence/lifecycle.ts", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    bootSequence.listeners.add(listener);
    return () => bootSequence.listeners.delete(listener);
  };

  return {
    ...(await importOriginal<typeof BootSequenceLifecycle>()),
    useIsBootSequenceComplete: () => useSyncExternalStore(subscribe, () => bootSequence.isComplete),
  };
});
vi.mock("#/features/boot-sequence/boot-sequence.tsx", () => ({ BootSequence: () => null }));

beforeEach(() => {
  bootSequence.isComplete = true;
});

function completeBootSequence() {
  bootSequence.isComplete = true;

  for (const listener of bootSequence.listeners) {
    listener();
  }
}

const menuBarNavigation = () => screen.findByRole("navigation", { name: "Main menu", hidden: true });

test("the desktop is inert while the boot sequence covers it", async () => {
  bootSequence.isComplete = false;
  renderRoute(collection.route);

  expect((await menuBarNavigation()).closest("[inert]")).not.toBeNull();
});

test("the desktop is not inert once the boot sequence has completed", async () => {
  renderRoute(collection.route);
  expect((await menuBarNavigation()).closest("[inert]")).toBeNull();
});

test("the initial window takes the focus once the boot sequence has completed", async () => {
  bootSequence.isComplete = false;
  renderRoute("/");

  const window = await screen.findByRole("region", { name: configuredPages[INITIAL_WINDOW_ROUTE.slice(1)]!.title });

  expect(document.activeElement).not.toBe(window);

  act(completeBootSequence);

  expect(document.activeElement).toBe(window);
});
