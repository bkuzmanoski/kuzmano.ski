import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Collection } from "#/site/catalog.ts";
import { configuredCollections } from "#/test-utils/catalog.ts";
import { fakeCollection, fakeCollectionEntries, fakeEntry } from "#/test-utils/collection.ts";
import { RouterContext } from "#/test-utils/router-context.tsx";
import { collectionEntryTargetOf } from "#/test-utils/windows.ts";

import { EntryColophon } from "./entry-colophon.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

afterEach(() => {
  vi.unstubAllEnvs();
});

const COLLECTION = fakeCollection(fakeCollectionEntries("newest", "middle", "oldest"));

const renderColophon = (slug: string, inCollection: Collection = COLLECTION) =>
  render(<EntryColophon target={collectionEntryTargetOf(inCollection, slug)} />, { wrapper: RouterContext });

test("the colophon is marked with the `data-feed-omit` attribute", () => {
  const { container } = renderColophon("middle");
  expect(container.querySelector("footer")!.hasAttribute("data-feed-omit")).toBe(true);
});

test("the `data-content-span` attribute of the colophon is `rail`", () => {
  const { container } = renderColophon("middle");
  expect(container.querySelector("footer")!.getAttribute("data-content-span")).toBe("rail");
});

test("the colophon links to the older and newer entries either side of the one being shown, each named by its direction, title, and date", () => {
  renderColophon("middle");

  expect(screen.getByRole("link", { name: /^Older oldest \S/ }).getAttribute("href")).toBe(
    COLLECTION.routeOf("oldest"),
  );
  expect(screen.getByRole("link", { name: /^Newer newest \S/ }).getAttribute("href")).toBe(
    COLLECTION.routeOf("newest"),
  );
});

test("the colophon links only to the older entry from the newest entry, and only to the newer entry from the oldest", () => {
  const { unmount } = renderColophon("newest");

  expect(screen.getByRole("link", { name: /^Older middle / })).toBeDefined();
  expect(screen.queryByRole("link", { name: /^Newer / })).toBeNull();

  unmount();
  renderColophon("oldest");

  expect(screen.getByRole("link", { name: /^Newer middle / })).toBeDefined();
  expect(screen.queryByRole("link", { name: /^Older / })).toBeNull();
});

test("the colophon omits the navigation to the older and newer entries for the only entry in a collection", () => {
  renderColophon("entry", fakeCollection([fakeEntry("entry")]));
  expect(screen.queryByRole("navigation")).toBeNull();
});

test("the colophon links to the entry's Markdown and its collection's feed", () => {
  const configuredCollection = Object.values(configuredCollections)[0]!;
  const entry = configuredCollection.list()[0]!;

  renderColophon(entry.slug, configuredCollection);

  expect(screen.getByRole("link", { name: "Markdown" }).getAttribute("href")).toBe(
    `${configuredCollection.routeOf(entry.slug)}.md`,
  );
  expect(screen.getByRole("link", { name: "Atom feed" }).getAttribute("href")).toBe(
    `${configuredCollection.route}/feed.xml`,
  );
});

test("the colophon omits the link to a draft entry's Markdown in production", () => {
  vi.stubEnv("DEV", false);
  renderColophon("entry", fakeCollection([fakeEntry("entry", { draft: true })]));

  expect(screen.queryByRole("link", { name: "Markdown" })).toBeNull();
});
