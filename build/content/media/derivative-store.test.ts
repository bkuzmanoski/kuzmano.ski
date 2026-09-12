import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fromContent } from "../../paths.ts";
import { MEDIA_FILE_HASH, resolvedImage } from "../../test-utils/media.ts";

import { createImageDerivativeStore, imageDerivativeAuditBetween } from "./derivative-store.ts";
import { MAX_RENDITION_BYTES, renditionSizeProblems } from "./problems.ts";
import { authoredRendition, imageDerivativeRendition } from "./renditions.ts";

import type * as derivatives from "./derivatives.ts";
import type { ImageDerivative } from "./derivatives.ts";

const encodeImageDerivative = vi.hoisted(() => vi.fn<typeof derivatives.encodeImageDerivative>()); // Encoding returns fixed bytes so each test decides whether it fails, without decoding a real image.

vi.mock("./derivatives.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof derivatives>()),
  encodeImageDerivative,
}));

const AVIF_DERIVATIVE: ImageDerivative = { format: "avif" };
const WEBP_DERIVATIVE: ImageDerivative = { format: "webp" };

const RESOLVED_IMAGE = resolvedImage();
const AVIF_RENDITION = imageDerivativeRendition(RESOLVED_IMAGE, AVIF_DERIVATIVE);

const DERIVATIVE_FILE_NAME = AVIF_RENDITION.derivativeFileName;
const TEMPORARY_FILE_NAME = `.${DERIVATIVE_FILE_NAME}.b9f4a2c1-7d3e-4a58-9c06-1f2e3d4a5b6c.tmp`;

const ENCODED_BYTES = Buffer.from("encoded");

describe("imageDerivativeAuditBetween", () => {
  const storedByteLengths = (...fileNames: Array<string>) =>
    new Map(fileNames.map((fileName) => [fileName, ENCODED_BYTES.byteLength]));

  test("returns a required derivative as missing when it is not stored, regardless of how many URLs it serves", () => {
    const otherEntryAvifRendition = imageDerivativeRendition(
      resolvedImage({ path: "collection/other-entry/image.png" }),
      AVIF_DERIVATIVE,
    );

    expect(
      imageDerivativeAuditBetween(
        [AVIF_RENDITION, otherEntryAvifRendition],
        storedByteLengths(imageDerivativeRendition(RESOLVED_IMAGE, WEBP_DERIVATIVE).derivativeFileName),
      ).missingDerivativeRenditions,
    ).toEqual([AVIF_RENDITION]);
  });

  test("ignores an authored rendition", () => {
    expect(imageDerivativeAuditBetween([authoredRendition(RESOLVED_IMAGE)], new Map())).toEqual({
      missingDerivativeRenditions: [],
      staleDerivativeFileNames: [],
      sizeProblems: [],
    });
  });

  test("returns stored derivative files that are no longer required as stale, in listing order", () => {
    const stored = storedByteLengths(
      `${MEDIA_FILE_HASH}.11223344.avif`,
      DERIVATIVE_FILE_NAME,
      `${MEDIA_FILE_HASH}.55667788.webp`,
    );

    expect(imageDerivativeAuditBetween([AVIF_RENDITION], stored).staleDerivativeFileNames).toEqual([
      `${MEDIA_FILE_HASH}.11223344.avif`,
      `${MEDIA_FILE_HASH}.55667788.webp`,
    ]);
  });

  test("ignores stored files with names the store does not generate", () => {
    expect(
      imageDerivativeAuditBetween([], storedByteLengths("README.md", "not-a-hash.avif", TEMPORARY_FILE_NAME))
        .staleDerivativeFileNames,
    ).toEqual([]);
  });

  test("checks the stored byte length of each required derivative against the maximum size", () => {
    const oversizedByteLength = MAX_RENDITION_BYTES + 1;
    const storedDerivativeByteLengths = new Map([[DERIVATIVE_FILE_NAME, oversizedByteLength]]);

    expect(imageDerivativeAuditBetween([AVIF_RENDITION], storedDerivativeByteLengths).sizeProblems).toEqual(
      renditionSizeProblems(AVIF_RENDITION, oversizedByteLength),
    );
  });
});

describe("createImageDerivativeStore", () => {
  let directoryAbsolutePath: string;

  beforeEach(async () => {
    directoryAbsolutePath = await mkdtemp(join(tmpdir(), "derivative-store-"));
    encodeImageDerivative.mockReset().mockResolvedValue(ENCODED_BYTES);
  });

  afterEach(() => rm(directoryAbsolutePath, { recursive: true, force: true }));

  test("writes the encoded bytes under the derivative name without leaving a temporary file, and returns their byte length", async () => {
    const store = createImageDerivativeStore(directoryAbsolutePath);

    await expect(store.encodeIfMissing(AVIF_RENDITION)).resolves.toBe(ENCODED_BYTES.byteLength);
    expect(encodeImageDerivative).toHaveBeenCalledWith(fromContent(RESOLVED_IMAGE.path), AVIF_DERIVATIVE);
    expect(await readdir(directoryAbsolutePath)).toEqual([DERIVATIVE_FILE_NAME]);
    expect(await readFile(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME))).toEqual(ENCODED_BYTES);
  });

  test("returns the byte length of each stored derivative, keyed by its file name", async () => {
    await writeFile(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME), ENCODED_BYTES);
    await expect(createImageDerivativeStore(directoryAbsolutePath).storedByteLengths()).resolves.toEqual(
      new Map([[DERIVATIVE_FILE_NAME, ENCODED_BYTES.byteLength]]),
    );
  });

  test.skipIf(process.getuid?.() === 0)(
    "rethrows a failure to measure a derivative other than its absence",
    async () => {
      const store = createImageDerivativeStore(directoryAbsolutePath);

      await chmod(directoryAbsolutePath, 0o000);

      try {
        await expect(store.encodeIfMissing(AVIF_RENDITION)).rejects.toThrow(/EACCES/);
        await expect(store.storedByteLengths()).rejects.toThrow(/EACCES/);
      } finally {
        await chmod(directoryAbsolutePath, 0o700);
      }
    },
  );

  test("returns an empty map when the directory does not exist yet", async () => {
    await expect(
      createImageDerivativeStore(join(directoryAbsolutePath, "missing")).storedByteLengths(),
    ).resolves.toEqual(new Map());
  });

  test("does not re-encode a derivative that is already stored", async () => {
    await writeFile(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME), ENCODED_BYTES);

    const store = createImageDerivativeStore(directoryAbsolutePath);

    await expect(store.encodeIfMissing(AVIF_RENDITION)).resolves.toBeNull();
    expect(encodeImageDerivative).not.toHaveBeenCalled();
  });

  test("encodes a derivative once for concurrent calls and resolves each call after the file is stored", async () => {
    const store = createImageDerivativeStore(directoryAbsolutePath);
    const encodeThenRead = async () => {
      const encodedByteLength = await store.encodeIfMissing(AVIF_RENDITION);
      return { encodedByteLength, storedBytes: await readFile(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME)) };
    };

    expect(await Promise.all([encodeThenRead(), encodeThenRead()])).toEqual([
      { encodedByteLength: ENCODED_BYTES.byteLength, storedBytes: ENCODED_BYTES },
      { encodedByteLength: ENCODED_BYTES.byteLength, storedBytes: ENCODED_BYTES },
    ]);
    expect(encodeImageDerivative).toHaveBeenCalledTimes(1);
  });

  test("does not store a file when encoding fails, and encodes the derivative on a later call", async () => {
    encodeImageDerivative.mockRejectedValueOnce(new Error("Encoding failed"));

    const store = createImageDerivativeStore(directoryAbsolutePath);

    await expect(store.encodeIfMissing(AVIF_RENDITION)).rejects.toThrow("Encoding failed");
    expect(await readdir(directoryAbsolutePath)).toEqual([]);
    await expect(store.encodeIfMissing(AVIF_RENDITION)).resolves.toBe(ENCODED_BYTES.byteLength);
    expect(await readFile(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME))).toEqual(ENCODED_BYTES);
    expect(encodeImageDerivative).toHaveBeenCalledTimes(2);
  });

  test("removes the temporary file when the encoded bytes cannot be moved into place", async () => {
    encodeImageDerivative.mockImplementationOnce(async () => {
      await mkdir(join(directoryAbsolutePath, DERIVATIVE_FILE_NAME, "child"), { recursive: true });
      return ENCODED_BYTES;
    });

    const store = createImageDerivativeStore(directoryAbsolutePath);

    await expect(store.encodeIfMissing(AVIF_RENDITION)).rejects.toThrow();
    expect(await readdir(directoryAbsolutePath)).toEqual([DERIVATIVE_FILE_NAME]);
  });

  test("excludes a hidden temporary file from the stored byte lengths and encodes the derivative it is named after", async () => {
    await writeFile(join(directoryAbsolutePath, TEMPORARY_FILE_NAME), ENCODED_BYTES.subarray(0, 3));

    const store = createImageDerivativeStore(directoryAbsolutePath);

    expect(await store.storedByteLengths()).toEqual(new Map());
    await expect(store.encodeIfMissing(AVIF_RENDITION)).resolves.toBe(ENCODED_BYTES.byteLength);
    expect(await store.storedByteLengths()).toEqual(new Map([[DERIVATIVE_FILE_NAME, ENCODED_BYTES.byteLength]]));
  });
});
