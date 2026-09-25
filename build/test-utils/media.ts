// This module imports only types from `/build/content`. Importing a value would read from the real content directory.
import { listedEntry } from "./listing.ts";

import type { AuthoredEntryMedia } from "../content/media/authored-media.ts";
import type { Mp4Metadata, ResolvedImage, ResolvedMediaFile, ResolvedVideo } from "../content/media/resolved-media.ts";

/** A truncated SHA-256 of the length the media file reader produces. */
export const MEDIA_FILE_HASH = "0f1e2d3c4b5a6978";

const ENTRY = listedEntry("collection", "entry");

export const ENTRY_ABSOLUTE_PATH = ENTRY.absolutePath;
export const BODY_IMAGE_FILE_NAME = "image.png";
export const VIDEO_FILE_NAME = "video.mp4";
export const POSTER_IMAGE_FILE_NAME = "video.poster.png";
export const COVER_IMAGE_FILE_PATH = "collection/entry.cover.png";
export const BODY_IMAGE_FILE_PATH = `${ENTRY.mediaDirectoryPath}/${BODY_IMAGE_FILE_NAME}`;
export const VIDEO_FILE_PATH = `${ENTRY.mediaDirectoryPath}/${VIDEO_FILE_NAME}`;
export const POSTER_IMAGE_FILE_PATH = `${ENTRY.mediaDirectoryPath}/${POSTER_IMAGE_FILE_NAME}`;

export const ENTRY_SOURCE = `![An image](./image.png)

<video src="./video.mp4" />
`;
const MEDIA_FILE_BYTES = 1024;
const IMAGE_DIMENSIONS = { width: 900, height: 500 };
export const VIDEO_DIMENSIONS = { width: 1280, height: 720 };
export const H264_MP4_METADATA: Mp4Metadata = {
  sampleFormats: ["avc1"],
  dimensions: VIDEO_DIMENSIONS,
  movieBoxPrecedesMediaData: true,
};

const resolvedMediaFile = (overrides: Partial<ResolvedMediaFile> = {}): ResolvedMediaFile => ({
  path: BODY_IMAGE_FILE_PATH,
  hash: MEDIA_FILE_HASH,
  bytes: MEDIA_FILE_BYTES,
  ...overrides,
});

export const resolvedImage = ({
  dimensions = IMAGE_DIMENSIONS,
  embeddedMetadataNames = [],
  ...overrides
}: Partial<ResolvedImage> = {}): ResolvedImage => ({
  ...resolvedMediaFile(overrides),
  dimensions,
  embeddedMetadataNames,
});

export const resolvedVideo = ({
  mp4Metadata = H264_MP4_METADATA,
  ...overrides
}: Partial<ResolvedVideo> = {}): ResolvedVideo => ({
  ...resolvedMediaFile({ path: VIDEO_FILE_PATH, ...overrides }),
  mp4Metadata,
});

/** An entry with a cover image, one body image, and a video paired with its poster image. */
export const authoredEntryMedia = (overrides: Partial<AuthoredEntryMedia> = {}): AuthoredEntryMedia => ({
  ...ENTRY,
  coverImageFilePath: COVER_IMAGE_FILE_PATH,
  bodyImageFileNames: [BODY_IMAGE_FILE_NAME],
  videos: [{ videoFileName: VIDEO_FILE_NAME, posterImageFileName: POSTER_IMAGE_FILE_NAME }],
  ...overrides,
});
