import { act, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { collectionEntries } from "#/test-utils/catalog.ts";
import { RouterContext } from "#/test-utils/router-context.tsx";

import { WindowBody } from "./window-body.tsx";

const openWindows = vi.hoisted(() => vi.fn<() => { entry?: { route: string; title: string } }>(() => ({})));

vi.mock("#/site/catalog.ts", async () => (await import("#/test-utils/catalog.ts")).siteCatalogMock());
vi.mock("#/lib/window-manager/context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({ content: openWindows }),
);
vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);
vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

const collectionEntry = collectionEntries[0]!;

const renderBody = (route: string) => render(<WindowBody route={route} />, { wrapper: RouterContext });

test("a collection route renders a link for every entry in the collection", () => {
  renderBody("/collection");

  expect(screen.getAllByRole("link")).toHaveLength(collectionEntries.length);
  expect(screen.getByRole("link", { name: collectionEntry.title })).toBeDefined();
});

test("the entry list marks the entry the window is showing, and only in the collection it belongs to", () => {
  openWindows.mockReturnValue({
    entry: { route: `/collection/${collectionEntry.slug}`, title: collectionEntry.title },
  });

  const { container, rerender } = renderBody("/collection");

  expect(screen.getByRole("link", { name: collectionEntry.title }).getAttribute("aria-current")).toBe("true");

  rerender(<WindowBody route="/other-collection" />);

  expect(container.querySelector("[aria-current]")).toBeNull();
});

test("an entry route suspends on its body chunk, from a collection or the top-level pages", async () => {
  const mounted = act(() => renderBody(`/collection/${collectionEntry.slug}`));

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined(); // The body arrives in a chunk of its own.

  const { rerender } = await mounted;
  const rerendered = act(() => {
    rerender(<WindowBody route="/page" />);
    return null;
  });

  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();

  await rerendered;
});

test("a route that does not match any content renders an empty window body", () => {
  const { container } = renderBody("/no-such-page");
  expect(container.innerHTML).toBe("");
});
