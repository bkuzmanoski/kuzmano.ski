import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { MEDIA_FILE_HASH } from "../../test-utils/media.ts";

import {
  IMAGE_ENCODING_OPTIONS,
  encodeImageDerivative,
  imageDerivativeFileName,
  imageDerivativeFingerprint,
} from "./derivatives.ts";

import type { ImageDerivative } from "./derivatives.ts";

const AVIF: ImageDerivative = { format: "avif" };
const WEBP: ImageDerivative = { format: "webp" };

describe("imageDerivativeFileName", () => {
  test("returns a file name containing the source hash, fingerprint, and suffix", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, AVIF)).toBe(
      `${MEDIA_FILE_HASH}.${imageDerivativeFingerprint(AVIF)}.avif`,
    );
  });

  test("returns the same file name for equivalent source and derivative inputs", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, AVIF)).toBe(imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF }));
  });

  test("returns the same file name for a derivative whatever order its fields are written in", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, { format: "avif", width: 128 })).toBe(
      imageDerivativeFileName(MEDIA_FILE_HASH, { width: 128, format: "avif" }),
    );
  });

  test("returns the same file name for a derivative that sets its format's default quality as for one that omits it", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF, quality: IMAGE_ENCODING_OPTIONS.avif.quality })).toBe(
      imageDerivativeFileName(MEDIA_FILE_HASH, AVIF),
    );
  });

  test("names a variant in the file name without changing the fingerprint of the encoding", () => {
    const thumbnail: ImageDerivative = { ...AVIF, variant: "thumbnail" };
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, thumbnail)).toBe(
      `${MEDIA_FILE_HASH}.${imageDerivativeFingerprint(AVIF)}.thumbnail.avif`,
    );
  });

  test("returns different file names for different derivatives of the same source", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, AVIF)).not.toBe(imageDerivativeFileName(MEDIA_FILE_HASH, WEBP));
  });

  test("returns different file names for derivatives with different widths", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF, width: 128 })).not.toBe(
      imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF, width: 160 }),
    );
  });

  test("returns different file names for derivatives with different quality settings", () => {
    expect(imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF, quality: 70 })).not.toBe(
      imageDerivativeFileName(MEDIA_FILE_HASH, { ...AVIF, quality: 80 }),
    );
  });
});

describe("encodeImageDerivative", () => {
  let directoryAbsolutePath: string;
  let imageAbsolutePath: string;

  beforeEach(async () => {
    directoryAbsolutePath = await mkdtemp(join(tmpdir(), "derivatives-"));
    imageAbsolutePath = join(directoryAbsolutePath, "image.png");
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } })
      .png()
      .toFile(imageAbsolutePath);
  });

  afterEach(() => rm(directoryAbsolutePath, { recursive: true, force: true }));

  const metadataOf = (bytes: Buffer) => sharp(bytes).metadata();

  test.each(["avif", "webp"] as const)("encodes an image as %s", async (format) => {
    const { format: encodedFormat } = await metadataOf(await encodeImageDerivative(imageAbsolutePath, { format }));
    expect(encodedFormat).toBe(format === "avif" ? "heif" : format); // sharp reports AVIF as its HEIF container.
  });

  test("resizes an image to the derivative's width, preserving its aspect ratio", async () => {
    const encodedBytes = await encodeImageDerivative(imageAbsolutePath, { format: "webp", width: 10 });
    await expect(metadataOf(encodedBytes)).resolves.toMatchObject({ width: 10, height: 5 });
  });

  test("keeps an image narrower than the derivative's width at its own size", async () => {
    const encodedBytes = await encodeImageDerivative(imageAbsolutePath, { format: "webp", width: 80 });
    await expect(metadataOf(encodedBytes)).resolves.toMatchObject({ width: 40, height: 20 });
  });

  test("applies the image's orientation tag before resizing it", async () => {
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } })
      .withMetadata({ orientation: 6 })
      .png()
      .toFile(imageAbsolutePath);

    const encodedBytes = await encodeImageDerivative(imageAbsolutePath, { format: "webp", width: 10 });

    await expect(metadataOf(encodedBytes)).resolves.toMatchObject({ width: 10, height: 20 });
  });

  test.each(["avif", "webp"] as const)("encodes a %s derivative without the image's metadata", async (format) => {
    const jpegAbsolutePath = join(directoryAbsolutePath, "image.jpg");

    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } })
      .withExifMerge({ IFD0: { Artist: "An artist" } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
      .withIccProfile("p3")
      .jpeg()
      .toFile(jpegAbsolutePath);

    const { exif, xmp, icc } = await metadataOf(await encodeImageDerivative(jpegAbsolutePath, { format }));

    expect({ exif, xmp, icc }).toEqual({ exif: undefined, xmp: undefined, icc: undefined });
  });

  test("encodes an image with the derivative's specified quality", async () => {
    const lowQualityBytes = await encodeImageDerivative(imageAbsolutePath, { format: "webp", quality: 1 });
    const highQualityBytes = await encodeImageDerivative(imageAbsolutePath, { format: "webp", quality: 100 });

    expect(lowQualityBytes).not.toEqual(highQualityBytes);
  });
});
