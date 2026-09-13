import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { mediaRoute } from "#/lib/content/paths.ts";

import { CONTENT_DIRECTORY_PATH, MEDIA_DIRECTORY_PATH } from "../../paths.ts";
import { MEDIA_FILE_HASH, resolvedImage } from "../../test-utils/media.ts";

import { imageDerivativeFileName, imageDerivativeFingerprint } from "./derivatives.ts";
import { authoredRendition, imageDerivativeRendition, rootRelativePathOf } from "./renditions.ts";

import type { ImageDerivative } from "./derivatives.ts";

const AVIF: ImageDerivative = { format: "avif" };
const THUMBNAIL_WEBP: ImageDerivative = { format: "webp", variant: "thumbnail", width: 128 };

describe("authoredRendition", () => {
  test("returns an authored rendition at a URL including the media file's hash, with the media type of its extension", () => {
    expect(authoredRendition(resolvedImage())).toMatchObject({
      origin: "authored",
      url: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.png`),
      type: "image/png",
    });
  });

  test("preserves the extension a file is written with after its hash", () => {
    expect(authoredRendition(resolvedImage({ path: "collection/entry.cover.jpg" })).url).toBe(
      mediaRoute(`collection/entry.cover.${MEDIA_FILE_HASH}.jpg`),
    );
  });

  test("returns a URL ending in the hash of a file without an extension", () => {
    expect(authoredRendition(resolvedImage({ path: "collection/entry/image" })).url).toBe(
      mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}`),
    );
  });
});

describe("imageDerivativeRendition", () => {
  test("returns a derivative rendition at a URL including the image's hash and the fingerprint of its encoding settings, with the media type of its format", () => {
    expect(imageDerivativeRendition(resolvedImage(), AVIF)).toMatchObject({
      url: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.${imageDerivativeFingerprint(AVIF)}.avif`),
      type: "image/avif",
    });
  });

  test("replaces the image's extension with the derivative's variant and format", () => {
    expect(
      imageDerivativeRendition(resolvedImage({ path: "collection/entry.cover.png" }), THUMBNAIL_WEBP),
    ).toMatchObject({
      url: mediaRoute(
        `collection/entry.cover.${MEDIA_FILE_HASH}.${imageDerivativeFingerprint(THUMBNAIL_WEBP)}.thumbnail.webp`,
      ),
      type: "image/webp",
    });
  });

  test("returns a different URL for a derivative with different encoding settings", () => {
    expect(imageDerivativeRendition(resolvedImage(), { ...AVIF, width: 128 }).url).not.toBe(
      imageDerivativeRendition(resolvedImage(), AVIF).url,
    );
  });

  test("names the derivative file after the image's bytes, so images with identical bytes share one", () => {
    const entryDerivative = imageDerivativeRendition(resolvedImage(), AVIF);
    const otherEntryDerivative = imageDerivativeRendition(
      resolvedImage({ path: "collection/other-entry/image.png" }),
      AVIF,
    );

    expect(otherEntryDerivative.url).not.toBe(entryDerivative.url);
    expect(otherEntryDerivative.derivativeFileName).toBe(entryDerivative.derivativeFileName);
    expect(entryDerivative.derivativeFileName).toBe(imageDerivativeFileName(MEDIA_FILE_HASH, AVIF));
  });
});

describe("rootRelativePathOf", () => {
  test("returns the content-directory path of an authored media rendition", () => {
    expect(rootRelativePathOf(authoredRendition(resolvedImage()))).toBe(
      `${CONTENT_DIRECTORY_PATH}/collection/entry/image.png`,
    );
  });

  test("returns the media-directory path of a derivative media rendition", () => {
    expect(rootRelativePathOf(imageDerivativeRendition(resolvedImage(), AVIF))).toBe(
      join(MEDIA_DIRECTORY_PATH, imageDerivativeFileName(MEDIA_FILE_HASH, AVIF)),
    );
  });
});
