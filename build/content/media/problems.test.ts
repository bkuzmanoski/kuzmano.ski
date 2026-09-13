import { describe, expect, test } from "vitest";

import { CONTENT_DIRECTORY_PATH } from "../../paths.ts";
import {
  COVER_IMAGE_FILE_PATH,
  H264_MP4_METADATA,
  POSTER_IMAGE_FILE_PATH,
  VIDEO_DIMENSIONS,
  VIDEO_FILE_PATH,
  resolvedImage,
  resolvedVideo,
} from "../../test-utils/media.ts";

import {
  MAX_RENDITION_BYTES,
  contentMediaProblemReport,
  coverImageProblems,
  fileSize,
  imageMetadataProblems,
  posterImageProblems,
  renditionSizeProblems,
  videoProblems,
} from "./problems.ts";
import { authoredRendition, imageDerivativeRendition } from "./renditions.ts";

import type { ResolvedImage } from "./resolved-media.ts";

const megabytesInBytes = (count: number) => count * 1024 * 1024;

const RESOLVED_IMAGE = resolvedImage();
const MAX_RENDITION_SIZE = fileSize(MAX_RENDITION_BYTES);
const OVERSIZED_RENDITION_SIZE = fileSize(MAX_RENDITION_BYTES + 1);

const coverImage = (overrides: Partial<ResolvedImage> = {}) =>
  resolvedImage({ path: COVER_IMAGE_FILE_PATH, dimensions: { width: 800, height: 800 }, ...overrides });

describe("fileSize", () => {
  test("formats a size smaller than a megabyte in whole kilobytes", () => {
    expect(fileSize(0)).toBe("0KB");
    expect(fileSize(51 * 1024 + 511)).toBe("51KB");
    expect(fileSize(51 * 1024 + 512)).toBe("52KB");
  });

  test("formats a size equal to or larger than a megabyte in megabytes to one decimal place", () => {
    expect(fileSize(1024 * 1024)).toBe("1MB");
    expect(fileSize(25 * 1024 * 1024)).toBe("25MB");
    expect(fileSize(25 * 1024 * 1024 + 1)).toBe("25MB");
    expect(fileSize(25.26 * 1024 * 1024)).toBe("25.3MB");
  });
});

describe("contentMediaProblemReport", () => {
  test("lists each problem on a line of its own", () => {
    expect(contentMediaProblemReport(["A problem.", "Another problem."])).toBe(
      "Content media could not be resolved:\n- A problem.\n- Another problem.",
    );
  });
});

describe("renditionSizeProblems", () => {
  test("accepts a rendition of exactly the maximum size", () => {
    expect(renditionSizeProblems(authoredRendition(RESOLVED_IMAGE), MAX_RENDITION_BYTES)).toEqual([]);
  });

  test("reports an authored rendition one byte over the maximum size, naming its size and the limit", () => {
    expect(renditionSizeProblems(authoredRendition(RESOLVED_IMAGE), MAX_RENDITION_BYTES + 1)).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" exceeds the ${MAX_RENDITION_SIZE} limit (${OVERSIZED_RENDITION_SIZE}).`,
    ]);
  });

  test("reports a derivative rendition one byte over the maximum size, naming the image it was encoded from", () => {
    expect(
      renditionSizeProblems(imageDerivativeRendition(RESOLVED_IMAGE, { format: "avif" }), MAX_RENDITION_BYTES + 1),
    ).toEqual([
      expect.stringContaining(
        `encoded from "${CONTENT_DIRECTORY_PATH}/collection/entry/image.png", exceeds the ${MAX_RENDITION_SIZE} limit (${OVERSIZED_RENDITION_SIZE}).`,
      ),
    ]);
  });
});

describe("coverImageProblems", () => {
  test("accepts a cover image within both limits", () => {
    expect(coverImageProblems(coverImage())).toEqual([]);
  });

  test("reports a cover image one pixel under the minimum size on its shortest side", () => {
    expect(coverImageProblems(coverImage({ dimensions: { width: 800, height: 143 } }))).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" is smaller than the 144px minimum on its shortest side (800x143px).`,
    ]);
  });

  test("accepts a cover image of exactly the minimum size on its shortest side", () => {
    expect(coverImageProblems(coverImage({ dimensions: { width: 800, height: 144 } }))).toEqual([]);
  });

  test("reports a cover image one byte over the maximum size", () => {
    expect(coverImageProblems(coverImage({ bytes: megabytesInBytes(5) + 1 }))).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" exceeds the 5MB limit (5MB).`,
    ]);
  });
});

describe("videoProblems", () => {
  test("accepts an H.264 video within every limit", () => {
    expect(videoProblems(resolvedVideo())).toEqual([]);
  });

  test("accepts a video with an AAC audio track", () => {
    const withAudio = { ...H264_MP4_METADATA, sampleFormats: ["avc1", "mp4a"] };
    expect(videoProblems(resolvedVideo({ mp4Metadata: withAudio }))).toEqual([]);
  });

  test("reports a video one byte over the maximum size without checking its metadata", () => {
    expect(videoProblems(resolvedVideo({ bytes: MAX_RENDITION_BYTES + 1, mp4Metadata: null }))).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" exceeds the ${MAX_RENDITION_SIZE} video limit (${OVERSIZED_RENDITION_SIZE}).`,
      ),
    ]);
  });

  test("accepts a video of exactly the maximum size", () => {
    expect(videoProblems(resolvedVideo({ bytes: MAX_RENDITION_BYTES }))).toEqual([]);
  });

  test("reports a file that is not an MP4 once", () => {
    expect(videoProblems(resolvedVideo({ mp4Metadata: null }))).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" is not an MP4 file.`),
    ]);
  });

  test("reports a video without an H.264 track, naming the format it contains instead", () => {
    const hevc = { ...H264_MP4_METADATA, sampleFormats: ["hvc1"] };
    expect(videoProblems(resolvedVideo({ mp4Metadata: hevc }))).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" contains unsupported formats (hvc1).`,
      ),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" has no H.264 video track.`),
    ]);
  });

  test("skips the dimension and box order checks for a video without an H.264 track", () => {
    const withoutTracks = { sampleFormats: [], dimensions: null, movieBoxPrecedesMediaData: false };
    expect(videoProblems(resolvedVideo({ mp4Metadata: withoutTracks }))).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" has no H.264 video track.`),
    ]);
  });

  test("reports a video that does not declare display dimensions", () => {
    expect(videoProblems(resolvedVideo({ mp4Metadata: { ...H264_MP4_METADATA, dimensions: null } }))).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" has an unknown render size (no display dimensions declared).`,
    ]);
  });

  test("reports a video whose media data precedes its movie box", () => {
    const mdatFirst = { ...H264_MP4_METADATA, movieBoxPrecedesMediaData: false };
    expect(videoProblems(resolvedVideo({ mp4Metadata: mdatFirst }))).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4"'s \`moov\` box must precede its \`mdat\` box.`,
      ),
    ]);
  });
});

describe("posterImageProblems", () => {
  const video = { path: VIDEO_FILE_PATH, dimensions: VIDEO_DIMENSIONS };
  const posterImage = (width: number, height: number) => ({
    path: POSTER_IMAGE_FILE_PATH,
    dimensions: { width, height },
  });

  test("accepts a poster image of the video's own dimensions", () => {
    expect(posterImageProblems(posterImage(1280, 720), video)).toEqual([]);
  });

  test("accepts a poster image scaled to the video's aspect ratio", () => {
    expect(posterImageProblems(posterImage(640, 360), video)).toEqual([]);
  });

  test("accepts a poster image one pixel off the video's aspect ratio", () => {
    expect(posterImageProblems(posterImage(640, 361), video)).toEqual([]);
  });

  test("reports a poster image of a different aspect ratio, naming both aspect ratios", () => {
    expect(posterImageProblems(posterImage(640, 480), video)).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.poster.png" (1.33) must match the aspect ratio of "${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" (1.78).`,
    ]);
  });
});

describe("imageMetadataProblems", () => {
  test("accepts an image without embedded metadata", () => {
    expect(imageMetadataProblems(RESOLVED_IMAGE)).toEqual([]);
  });

  test("reports the metadata an image embeds", () => {
    expect(imageMetadataProblems(resolvedImage({ embeddedMetadataNames: ["Exif", "XMP", "text"] }))).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" contains embedded metadata`),
    ]);
  });
});
