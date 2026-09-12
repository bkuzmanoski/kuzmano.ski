import { describe, expect, test } from "vitest";

import type { EntryKey } from "#/lib/content/entry-file.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID, entryCoverImagesPlugin } from "./entry-cover-images.ts";

const COVER_IMAGE: CoverImage = {
  social: { src: mediaRoute("collection/entry.cover.png"), width: 512, height: 512 },
  thumbnail: { kind: "image", src: mediaRoute("collection/entry.cover.webp"), width: 128, height: 128, alternates: [] },
};

const pluginServing = (coverImages: Record<EntryKey, CoverImage>) => {
  const plugin = entryCoverImagesPlugin(() => Promise.resolve(coverImages));

  return {
    resolveId: plugin.resolveId as (source: string) => string | null,
    load: plugin.load as (id: string) => Promise<string | null>,
  };
};

describe("entryCoverImagesPlugin", () => {
  test("resolves the virtual module's ID", () => {
    expect(pluginServing({}).resolveId("virtual:entry-cover-images")).toBe(RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID);
    expect(pluginServing({}).resolveId("virtual:other-module")).toBeNull();
  });

  test("exports the cover images it loads", async () => {
    const coverImages = { ["collection/entry" as EntryKey]: COVER_IMAGE };

    await expect(pluginServing(coverImages).load(RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID)).resolves.toBe(
      `export const ENTRY_COVER_IMAGES = ${JSON.stringify(coverImages)};`,
    );
  });

  test("loads only the virtual module", async () => {
    await expect(pluginServing({}).load("/src/other-module.ts")).resolves.toBeNull();
  });
});
