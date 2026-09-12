import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeFileAtomically } from "../../files.ts";
import { fromContent } from "../../paths.ts";

import { encodeImageDerivative } from "./derivatives.ts";
import { renditionSizeProblems } from "./problems.ts";

import type { ImageDerivativeRendition, MediaRendition } from "./renditions.ts";

interface ImageDerivativeStore {
  encodeIfMissing: (rendition: ImageDerivativeRendition) => Promise<number | null>; // The encoded byte length.
  storedByteLengths: () => Promise<Map<string, number>>; // Keyed by file name, in listing order.
  remove: (fileName: string) => Promise<void>;
}

interface ImageDerivativeAudit {
  missingDerivativeRenditions: Array<ImageDerivativeRendition>;
  staleDerivativeFileNames: Array<string>;
  sizeProblems: Array<string>;
}

const GENERATED_FILE_NAME = /^[0-9a-f]+\.[0-9a-f]+\.[a-z0-9.]+$/;

const isMissingFileError = (cause: unknown) => cause instanceof Error && "code" in cause && cause.code === "ENOENT";

/** Compares indexed derivative renditions with files stored in the media directory. */
export function imageDerivativeAuditBetween(
  renditions: Iterable<MediaRendition>,
  storedByteLengths: Map<string, number>,
): ImageDerivativeAudit {
  const derivativesByFileName = new Map<string, ImageDerivativeRendition>();

  for (const rendition of renditions) {
    if (rendition.origin === "derivative" && !derivativesByFileName.has(rendition.derivativeFileName)) {
      derivativesByFileName.set(rendition.derivativeFileName, rendition);
    }
  }

  const derivativeRenditions = [...derivativesByFileName.values()];

  return {
    missingDerivativeRenditions: derivativeRenditions.filter(
      ({ derivativeFileName }) => !storedByteLengths.has(derivativeFileName),
    ),
    staleDerivativeFileNames: [...storedByteLengths.keys()].filter(
      (fileName) => GENERATED_FILE_NAME.test(fileName) && !derivativesByFileName.has(fileName),
    ),
    sizeProblems: derivativeRenditions.flatMap((rendition) => {
      const storedByteLength = storedByteLengths.get(rendition.derivativeFileName);

      return storedByteLength === undefined ? [] : renditionSizeProblems(rendition, storedByteLength);
    }),
  };
}

export function createImageDerivativeStore(directoryAbsolutePath: string): ImageDerivativeStore {
  const pendingEncodings = new Map<string, Promise<number | null>>();

  async function byteLengthOf(fileName: string) {
    try {
      return (await stat(join(directoryAbsolutePath, fileName))).size;
    } catch (cause) {
      if (isMissingFileError(cause)) {
        return null;
      }

      throw cause;
    }
  }

  async function encodeAndStore({ derivativeFileName, resolvedMediaFile, derivative }: ImageDerivativeRendition) {
    if ((await byteLengthOf(derivativeFileName)) !== null) {
      return null;
    }

    const encodedBytes = await encodeImageDerivative(fromContent(resolvedMediaFile.path), derivative);

    await mkdir(directoryAbsolutePath, { recursive: true });
    await writeFileAtomically(join(directoryAbsolutePath, derivativeFileName), (temporaryFilePath) =>
      writeFile(temporaryFilePath, encodedBytes),
    );

    return encodedBytes.byteLength;
  }

  return {
    encodeIfMissing(rendition) {
      const { derivativeFileName } = rendition;
      const pendingEncoding = pendingEncodings.get(derivativeFileName);

      if (pendingEncoding) {
        return pendingEncoding;
      }

      const encoding = encodeAndStore(rendition).finally(() => {
        pendingEncodings.delete(derivativeFileName); // Allow retries after failures and detect later file removal.
      });

      pendingEncodings.set(derivativeFileName, encoding);

      return encoding;
    },
    async storedByteLengths() {
      let fileNames: Array<string>;

      try {
        fileNames = await readdir(directoryAbsolutePath);
      } catch (cause) {
        if (isMissingFileError(cause)) {
          return new Map(); // The directory does not exist.
        }

        throw cause;
      }

      const byteLengths = await Promise.all(
        fileNames
          .filter((fileName) => !fileName.startsWith("."))
          .map(async (fileName) => [fileName, await byteLengthOf(fileName)] as const),
      );

      return new Map(byteLengths.flatMap(([name, byteLength]) => (byteLength === null ? [] : [[name, byteLength]])));
    },
    remove: (fileName) => unlink(join(directoryAbsolutePath, fileName)),
  };
}
