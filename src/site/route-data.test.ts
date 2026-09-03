import { afterEach, expect, test, vi } from "vitest";

import { PAGE_SLUGS } from "#/config/content";

import { contentRoute } from "./route-data";

vi.mock("#/site/catalog", async () => {
  const { PAGE_SLUGS: slugs } = await import("#/config/content");
  const { fakeCollection, fakeContentIndex, fakeEntries, fakeEntry } = await import("#/test-utils/collection");
  const { siteCatalogMock } = await import("#/test-utils/catalog");

  return siteCatalogMock({
    collections: {
      collection: fakeCollection([...fakeEntries("published"), fakeEntry("draft", { draft: true })]),
    },
    pages: fakeContentIndex([
      fakeEntry(slugs[0]),
      fakeEntry("unlisted-page"),
      fakeEntry("draft-page", { draft: true }),
    ]),
  });
});

const REGISTERED_PAGE = PAGE_SLUGS[0];

const loadEntry = (slug: string) => contentRoute.loader({ params: { segment: "collection", slug } });
const loadPage = (segment: string) => contentRoute.loader({ params: { segment } });

afterEach(() => {
  vi.unstubAllEnvs();
});

test("an entry the site publishes is not marked noindex", () => {
  expect(loadEntry("published").noindex).toBeFalsy();
});

test("a draft entry is marked noindex", () => {
  expect(loadEntry("draft").noindex).toBe(true);
});

test("a page the site links to is not marked noindex", () => {
  expect(loadPage(REGISTERED_PAGE).noindex).toBeFalsy();
});

test("a page the site does not link to is marked noindex", () => {
  expect(loadPage("unlisted-page").noindex).toBe(true);
});

test("a collection listing is not marked noindex", () => {
  expect(loadPage("collection").noindex).toBeUndefined();
});

test("a published entry exposes the Markdown alternate the build emits for it", () => {
  vi.stubEnv("DEV", false);
  expect(loadEntry("published").markdown).toBe(true);
});

test("a draft entry does not expose a Markdown alternate, which is not emitted in a production build", () => {
  vi.stubEnv("DEV", false);

  expect(loadEntry("draft").markdown).toBe(false);
  expect(loadPage("draft-page").markdown).toBe(false);
});

test("a draft exposes its Markdown alternate in development, where the server renders one", () => {
  vi.stubEnv("DEV", true);
  expect(loadEntry("draft").markdown).toBe(true);
});

test("a collection listing exposes its Markdown alternate", () => {
  vi.stubEnv("DEV", false);
  expect(loadPage("collection").markdown).toBe(true);
});
