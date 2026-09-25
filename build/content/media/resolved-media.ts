import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import { MP4BoxBuffer, createFile } from "mp4box";
import sharp from "sharp";

import type { Dimensions } from "#/lib/content/media.ts";

import { fromContent, quotedContentPath } from "../../paths.ts";

import type { Movie } from "mp4box";
import type { Metadata } from "sharp";

const HASH_LENGTH = 16;

/** A hashed authored media file under the content directory. */
export interface ResolvedMediaFile {
  path: string; // Relative to the content directory.
  hash: string; // Truncated SHA-256 of its bytes.
  bytes: number;
}

/** A resolved image with its displayed dimensions and the metadata it embeds. */
export interface ResolvedImage extends ResolvedMediaFile {
  dimensions: Dimensions;
  embeddedMetadataNames: Array<string>;
}

export interface Mp4Metadata {
  sampleFormats: Array<string>; // Four-character format of each track, such as `avc1` for H.264.
  dimensions: Dimensions | null; // The display dimensions of the first track that declares any.
  movieBoxPrecedesMediaData: boolean; // Whether `moov` precedes `mdat`, allowing playback before the full file downloads.
}

/** A resolved video with metadata read from its MP4 boxes. */
export interface ResolvedVideo extends ResolvedMediaFile {
  mp4Metadata: Mp4Metadata | null; // `null` when the file is not an MP4.
}

/** An image sharp could not decode and its error message. */
export interface UnreadableImage {
  problem: string;
}

export interface MediaFileReader {
  readImage: (path: string) => Promise<ResolvedImage | UnreadableImage>;
  readVideo: (path: string) => Promise<ResolvedVideo>;
}

/** Parses `bytes` as an MP4, or returns `null` when they contain no movie box to describe. */
export function mp4MetadataIn(bytes: Buffer): Mp4Metadata | null {
  const file = createFile();

  let movie = undefined as Movie | undefined;

  // mp4box reports the movie while the buffer is appended, so it has reported by the time `flush` returns.
  file.onReady = (parsedMovie) => {
    movie = parsedMovie;
  };
  file.appendBuffer(
    MP4BoxBuffer.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 0),
  );
  file.flush();

  if (!movie) {
    return null;
  }

  const trackWithDimensions = movie.tracks.find(({ track_width, track_height }) => track_width > 0 && track_height > 0);

  return {
    sampleFormats: movie.tracks.map(({ codec }) => codec.split(".")[0]!), // A codec string such as `avc1.64000d` begins with the sample entry's four-character format.
    dimensions: trackWithDimensions
      ? { width: Math.round(trackWithDimensions.track_width), height: Math.round(trackWithDimensions.track_height) }
      : null,
    movieBoxPrecedesMediaData: movie.isProgressive,
  };
}

async function readMediaFile(path: string): Promise<{ resolvedMediaFile: ResolvedMediaFile; contents: Buffer }> {
  const contents = await readFile(fromContent(path));
  const hash = createHash("sha256").update(contents).digest("hex").slice(0, HASH_LENGTH);

  return { resolvedMediaFile: { path, hash, bytes: contents.byteLength }, contents };
}

const embeddedMetadataNamesOf = ({ exif, xmp, iptc, tifftagPhotoshop, comments }: Metadata) => [
  ...(exif ? ["Exif"] : []),
  ...(xmp ? ["XMP"] : []),
  ...(iptc ? ["IPTC"] : []),
  ...(tifftagPhotoshop ? ["Photoshop"] : []),
  ...(comments?.length ? ["text"] : []), // PNG text chunks.
];

// Returns an `UnreadableImage` instead of throwing when sharp cannot decode the bytes, so a corrupt
// or partially-saved file is reported alongside other problems rather than in place of them.
async function readImage(path: string): Promise<ResolvedImage | UnreadableImage> {
  const { resolvedMediaFile, contents } = await readMediaFile(path);
  const unreadableImage = (reason: string): UnreadableImage => ({
    problem: `${quotedContentPath(path)} could not be read as an image: ${reason}`,
  });

  try {
    const metadata = await sharp(contents).metadata();
    const { width, height } = metadata.autoOrient;

    return width && height
      ? {
          ...resolvedMediaFile,
          dimensions: { width, height },
          embeddedMetadataNames: embeddedMetadataNamesOf(metadata),
        }
      : unreadableImage("The image does not declare its dimensions.");
  } catch (cause) {
    return unreadableImage(cause instanceof Error ? cause.message : String(cause));
  }
}

async function readVideo(path: string): Promise<ResolvedVideo> {
  const { resolvedMediaFile, contents } = await readMediaFile(path);
  return { ...resolvedMediaFile, mp4Metadata: mp4MetadataIn(contents) };
}

/** Caches media results until a file's size or modification time changes. */
export function createMediaFileReader(): MediaFileReader {
  function cached<TReading>(read: (path: string) => Promise<TReading>) {
    const resultsByPath = new Map<string, { signature: string; result: Promise<TReading> }>();
    return async (path: string): Promise<TReading> => {
      const { size, mtimeNs } = await stat(fromContent(path), { bigint: true });
      const signature = `${size}:${mtimeNs}`;
      const cachedResult = resultsByPath.get(path);

      if (cachedResult?.signature === signature) {
        return cachedResult.result;
      }

      const result = read(path);

      resultsByPath.set(path, { signature, result });
      result.catch(() => {
        if (resultsByPath.get(path)?.result === result) {
          resultsByPath.delete(path); // A rejected result is removed so the next index build retries reading the file instead of reusing the rejection.
        }
      });

      return result;
    };
  }

  return { readImage: cached(readImage), readVideo: cached(readVideo) };
}
