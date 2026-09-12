import { join } from "node:path";

import { mediaRoute } from "#/lib/content/paths.ts";

import { CONTENT_DIRECTORY_PATH, MEDIA_DIRECTORY_PATH } from "../../paths.ts";

import { imageDerivativeExtensionOf, imageDerivativeFileName } from "./derivatives.ts";
import { IMAGE_MEDIA_TYPES, authoredExtensionOf, mediaTypeOf, withoutExtension } from "./formats.ts";

import type { ImageDerivative } from "./derivatives.ts";
import type { ResolvedImage, ResolvedMediaFile } from "./resolved-media.ts";

/** Serves a resolved media file's original bytes from the content directory. */
interface AuthoredRendition {
  origin: "authored";
  url: string;
  type: string; // Media type of the served bytes.
  resolvedMediaFile: ResolvedMediaFile;
}

/** Serves bytes derived from a resolved image under the media directory. */
export interface ImageDerivativeRendition {
  origin: "derivative";
  url: string;
  type: string;
  resolvedMediaFile: ResolvedImage;
  derivative: ImageDerivative;
  derivativeFileName: string;
}

export type MediaRendition = AuthoredRendition | ImageDerivativeRendition;

const mediaUrlOf = (filePath: string, versionedFileName: string) =>
  mediaRoute(`${withoutExtension(filePath)}.${versionedFileName}`);

export const authoredRendition = (resolvedMediaFile: ResolvedMediaFile): AuthoredRendition => ({
  origin: "authored",
  url: mediaUrlOf(resolvedMediaFile.path, `${resolvedMediaFile.hash}${authoredExtensionOf(resolvedMediaFile.path)}`),
  type: mediaTypeOf(resolvedMediaFile.path) ?? "application/octet-stream", // Formats not listed in `formats.ts` are served as opaque downloads.
  resolvedMediaFile,
});

/**
 * Creates a derivative URL fingerprinted by image hash and encoding settings.
 *
 * Immutable `/media/*` caching requires a new URL for each encoding.
 */
export function imageDerivativeRendition(
  resolvedImage: ResolvedImage,
  derivative: ImageDerivative,
): ImageDerivativeRendition {
  const derivativeFileName = imageDerivativeFileName(resolvedImage.hash, derivative);
  return {
    origin: "derivative",
    url: mediaUrlOf(resolvedImage.path, derivativeFileName),
    type: IMAGE_MEDIA_TYPES[imageDerivativeExtensionOf(derivative)],
    resolvedMediaFile: resolvedImage,
    derivative,
    derivativeFileName,
  };
}

/**
 * Returns the repository-relative path served by a rendition.
 *
 * Authored files are under the content directory; derivatives are under the media directory.
 */
export const rootRelativePathOf = (rendition: MediaRendition) =>
  rendition.origin === "authored"
    ? join(CONTENT_DIRECTORY_PATH, rendition.resolvedMediaFile.path)
    : join(MEDIA_DIRECTORY_PATH, rendition.derivativeFileName);
