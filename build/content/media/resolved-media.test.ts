import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32 } from "node:zlib";

import sharp from "sharp";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CONTENT_DIRECTORY_PATH, fromRoot } from "../../paths.ts";

import { createMediaFileReader, mp4MetadataIn } from "./resolved-media.ts";

import type { ResolvedImage, UnreadableImage } from "./resolved-media.ts";

const { readFile, stat } = vi.hoisted(() => ({
  readFile: vi.fn<(path: string) => Promise<Buffer>>(),
  stat: vi.fn<(path: string) => Promise<{ size: bigint; mtimeNs: bigint }>>(),
}));

vi.mock("node:fs/promises", () => ({ default: { readFile, stat }, readFile, stat }));

const IMAGE_FILE_PATH = "collection/entry/image.png";
const VIDEO_FILE_PATH = "collection/entry/video.mp4";

// Real files from ffmpeg: `h264.mp4` is a video alone, `aac-h264.mp4` puts an audio track before
// its video track, and `hevc.mp4` is in a format the site does not serve.
const fixture = (fileName: string) => readFileSync(join(fromRoot("build/test-utils/fixtures"), fileName));

const solidImage = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#000000" } });
const pngBytes = (width: number, height: number) => solidImage(width, height).png().toBuffer();

// Inserts a `tEXt` chunk after a PNG's `IHDR` chunk.
function withTextChunk(imageBytes: Buffer, keyword: string, text: string): Buffer {
  const typeAndData = Buffer.from(`tEXt${keyword}\0${text}`, "latin1");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(typeAndData.byteLength - 4);
  checksum.writeUInt32BE(crc32(typeAndData));

  return Buffer.concat([imageBytes.subarray(0, 33), length, typeAndData, checksum, imageBytes.subarray(33)]);
}

const fileStats = (size: number, mtimeNs: number) => ({ size: BigInt(size), mtimeNs: BigInt(mtimeNs) });

const hashOf = (image: ResolvedImage | UnreadableImage) => ("problem" in image ? null : image.hash);

// Moves a file's top-level `moov` box after the boxes that follow it, as an encoder without `+faststart` writes it.
function withMovieBoxLast(bytes: Buffer): Buffer {
  const topLevelBoxes: Array<{ type: string; bytes: Buffer }> = [];

  for (let offset = 0; offset < bytes.byteLength; offset += bytes.readUInt32BE(offset)) {
    topLevelBoxes.push({
      type: bytes.toString("latin1", offset + 4, offset + 8),
      bytes: bytes.subarray(offset, offset + bytes.readUInt32BE(offset)),
    });
  }

  return Buffer.concat(
    [
      ...topLevelBoxes.filter(({ type }) => type !== "moov"),
      ...topLevelBoxes.filter(({ type }) => type === "moov"),
    ].map((box) => box.bytes),
  );
}

beforeEach(async () => {
  readFile.mockReset().mockResolvedValue(await pngBytes(3, 2));
  stat.mockReset().mockResolvedValue(fileStats(1024, 1));
});

describe("createMediaFileReader", () => {
  test("hashes an image's bytes and reads its dimensions from them", async () => {
    const imageBytes = await pngBytes(3, 2);

    readFile.mockResolvedValue(imageBytes);

    const resolvedImage = await createMediaFileReader().readImage(IMAGE_FILE_PATH);

    expect(resolvedImage).toMatchObject({
      path: IMAGE_FILE_PATH,
      bytes: imageBytes.byteLength,
      dimensions: { width: 3, height: 2 },
    });
    expect(hashOf(resolvedImage)).toMatch(/^[0-9a-f]{16}$/);
  });

  test("reads an image's dimensions with its orientation tag applied", async () => {
    readFile.mockResolvedValue(await solidImage(3, 2).withMetadata({ orientation: 6 }).png().toBuffer());
    await expect(createMediaFileReader().readImage(IMAGE_FILE_PATH)).resolves.toMatchObject({
      dimensions: { width: 2, height: 3 },
    });
  });

  test("names the Exif and XMP metadata an image embeds, and omits its color profile", async () => {
    readFile.mockResolvedValue(
      await solidImage(3, 2)
        .withExifMerge({ IFD0: { Artist: "An artist" } })
        .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
        .withIccProfile("p3")
        .jpeg()
        .toBuffer(),
    );
    await expect(createMediaFileReader().readImage(IMAGE_FILE_PATH)).resolves.toMatchObject({
      embeddedMetadataNames: ["Exif", "XMP"],
    });
  });

  test("names a PNG's text chunks as text metadata", async () => {
    readFile.mockResolvedValue(withTextChunk(await pngBytes(3, 2), "Software", "An image editor"));
    await expect(createMediaFileReader().readImage(IMAGE_FILE_PATH)).resolves.toMatchObject({
      embeddedMetadataNames: ["text"],
    });
  });

  test("returns an empty list of metadata names for an image without embedded metadata", async () => {
    await expect(createMediaFileReader().readImage(IMAGE_FILE_PATH)).resolves.toMatchObject({
      embeddedMetadataNames: [],
    });
  });

  test("returns the same hash for identical bytes and a different hash for different bytes", async () => {
    const hashOfBytes = async (imageBytes: Buffer) => {
      readFile.mockResolvedValue(imageBytes);
      return hashOf(await createMediaFileReader().readImage(IMAGE_FILE_PATH));
    };

    const imageBytes = await pngBytes(3, 2);

    expect(await hashOfBytes(Buffer.from(imageBytes))).toBe(await hashOfBytes(imageBytes));
    expect(await hashOfBytes(await pngBytes(2, 3))).not.toBe(await hashOfBytes(imageBytes));
  });

  test("reports an image sharp cannot decode instead of throwing", async () => {
    readFile.mockResolvedValue(Buffer.from("A file that is not an image."));

    const unreadableImage = await createMediaFileReader().readImage(IMAGE_FILE_PATH);

    expect("problem" in unreadableImage ? unreadableImage.problem : null).toContain(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" could not be read as an image: `,
    );
  });

  test("reads a video's size and its MP4 metadata from its bytes", async () => {
    const videoBytes = fixture("h264.mp4");

    readFile.mockResolvedValue(videoBytes);

    await expect(createMediaFileReader().readVideo(VIDEO_FILE_PATH)).resolves.toMatchObject({
      bytes: videoBytes.byteLength,
      mp4Metadata: { sampleFormats: ["avc1"] },
    });
  });

  test("returns a file's cached result while its size and modification time are unchanged", async () => {
    const reader = createMediaFileReader();
    const firstResult = await reader.readImage(IMAGE_FILE_PATH);

    expect(await reader.readImage(IMAGE_FILE_PATH)).toBe(firstResult);
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  test("performs only one file read for concurrent reads of the same file", async () => {
    const reader = createMediaFileReader();

    await Promise.all([reader.readImage(IMAGE_FILE_PATH), reader.readImage(IMAGE_FILE_PATH)]);

    expect(readFile).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["size", fileStats(2048, 1)],
    ["modification time", fileStats(1024, 2)],
  ])("reads a file again when its %s changes", async (_, changedFileStats) => {
    const reader = createMediaFileReader();

    await reader.readImage(IMAGE_FILE_PATH);
    stat.mockResolvedValue(changedFileStats);
    await reader.readImage(IMAGE_FILE_PATH);

    expect(readFile).toHaveBeenCalledTimes(2);
  });

  test("reads a file again after a previous attempt fails", async () => {
    const reader = createMediaFileReader();

    readFile.mockRejectedValueOnce(new Error("The file could not be read."));

    await expect(reader.readImage(IMAGE_FILE_PATH)).rejects.toThrow("The file could not be read.");
    await expect(reader.readImage(IMAGE_FILE_PATH)).resolves.toMatchObject({ dimensions: { width: 3, height: 2 } });
    expect(readFile).toHaveBeenCalledTimes(2);
  });
});

describe("mp4MetadataIn", () => {
  test("reads an H.264 file into one `avc1` track at its encoded size, with its movie box first", () => {
    expect(mp4MetadataIn(fixture("h264.mp4"))).toEqual({
      sampleFormats: ["avc1"],
      dimensions: { width: 320, height: 180 },
      movieBoxPrecedesMediaData: true,
    });
  });

  test("reads the sample format of each track in the order the tracks appear", () => {
    expect(mp4MetadataIn(fixture("aac-h264.mp4"))?.sampleFormats).toEqual(["mp4a", "avc1"]);
  });

  test("reads the display dimensions of the first track that declares any", () => {
    expect(mp4MetadataIn(fixture("aac-h264.mp4"))?.dimensions).toEqual({ width: 160, height: 90 });
  });

  test("reads the sample format of a track the site does not serve", () => {
    expect(mp4MetadataIn(fixture("hevc.mp4"))?.sampleFormats).toEqual(["hvc1"]);
  });

  test("identifies a `moov` after the `mdat` as the movie box following the media data", () => {
    expect(mp4MetadataIn(withMovieBoxLast(fixture("h264.mp4")))?.movieBoxPrecedesMediaData).toBe(false);
  });

  test("returns null for bytes that are not an MP4", () => {
    expect(mp4MetadataIn(Buffer.from("\x1aE\xdf\xa3 not matroska either", "latin1"))).toBeNull();
  });

  test("returns null for a buffer shorter than one box header", () => {
    expect(mp4MetadataIn(Buffer.alloc(4))).toBeNull();
  });

  test("returns null for a file that ends before its movie box", () => {
    const movieBoxLast = withMovieBoxLast(fixture("h264.mp4"));
    expect(mp4MetadataIn(movieBoxLast.subarray(0, movieBoxLast.byteLength - 16))).toBeNull();
  });

  test("reads a file truncated within its media data when its movie box comes first", () => {
    const bytes = fixture("h264.mp4");
    expect(mp4MetadataIn(bytes.subarray(0, bytes.byteLength - 16))?.sampleFormats).toEqual(["avc1"]);
  });
});
