import { describe, expect, test } from "vitest";

import type { EntryKey } from "#/lib/content/entry-file.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { hookOf } from "../../test-utils/plugin-hooks.ts";

import { RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID, entryCoverImagesPlugin } from "./entry-cover-images.ts";

import type { LoadHook } from "../../test-utils/plugin-hooks.ts";

const COVER_IMAGE: CoverImage = { src: mediaRoute("collection/entry.cover.png"), width: 512, height: 512 };

const pluginServing = (coverImages: Record<EntryKey, CoverImage>) =>
  entryCoverImagesPlugin(() => Promise.resolve(coverImages));

describe("entryCoverImagesPlugin", () => {
  test("exports the cover images it loads", async () => {
    const coverImages = { ["collection/entry" as EntryKey]: COVER_IMAGE };
    await expect(
      hookOf<LoadHook>(pluginServing(coverImages), "load").call({}, RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID),
    ).resolves.toBe(`export const ENTRY_COVER_IMAGES = ${JSON.stringify(coverImages)};`);
  });
});
