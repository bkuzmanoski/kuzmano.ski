import { describe, expect, test } from "vitest";

import type { EntryKey } from "#/lib/content/entry-file.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { hookOf } from "../../test-utils/plugin-hooks.ts";

import { RESOLVED_ENTRY_ICON_URLS_MODULE_ID, entryIconUrlsPlugin } from "./entry-icon-urls.ts";

import type { LoadHook } from "../../test-utils/plugin-hooks.ts";

const pluginServing = (entryIconUrls: Record<EntryKey, string>) =>
  entryIconUrlsPlugin(() => Promise.resolve(entryIconUrls));

describe("entryIconUrlsPlugin", () => {
  test("exports the entry icon URLs it loads", async () => {
    const entryIconUrls = { ["collection/entry" as EntryKey]: mediaRoute("collection/entry.icon.svg") };
    await expect(
      hookOf<LoadHook>(pluginServing(entryIconUrls), "load").call({}, RESOLVED_ENTRY_ICON_URLS_MODULE_ID),
    ).resolves.toBe(`export const ENTRY_ICON_URLS = ${JSON.stringify(entryIconUrls)};`);
  });
});
