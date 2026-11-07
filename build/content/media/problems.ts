import type { Dimensions } from "#/lib/content/media.ts";

import { quotedContentPath } from "../../paths.ts";

import { isEncodableImage } from "./formats.ts";
import { rootRelativePathOf } from "./renditions.ts";

import type { MediaRendition } from "./renditions.ts";
import type { ResolvedEntryIcon, ResolvedImage, ResolvedVideo } from "./resolved-media.ts";

/** X `summary` cards drop smaller images. */
const MIN_OPEN_GRAPH_IMAGE_SHORTEST_SIDE_PX = 144;

/** X fetches cover images up to this size. */
const MAX_OPEN_GRAPH_IMAGE_BYTES = 5 * 1024 * 1024;

/** The largest file Cloudflare serves as a static asset. */
export const MAX_RENDITION_BYTES = 25 * 1024 * 1024;

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = 1024 * 1024;

const H264_SAMPLE_FORMAT = "avc1";
const AAC_SAMPLE_FORMAT = "mp4a";

/** Allowed poster/video aspect-ratio difference for rounding and non-square video pixels. */
const ASPECT_RATIO_TOLERANCE = 0.01;

const REENCODE_VIDEO_REMEDY = "Re-encode it with `npm run encode-video`.";

const aspectRatioOf = ({ width, height }: Dimensions) => width / height;

export const fileSize = (bytes: number) =>
  bytes < BYTES_PER_MEGABYTE
    ? `${Math.round(bytes / BYTES_PER_KILOBYTE)}KB`
    : `${Math.round((bytes / BYTES_PER_MEGABYTE) * 10) / 10}MB`;

export function coverImageProblems({
  path,
  bytes,
  dimensions: { width, height },
}: Pick<ResolvedImage, "path" | "bytes" | "dimensions">): Array<string> {
  const problems: Array<string> = [];
  const quotedFilePath = quotedContentPath(path);

  if (Math.min(width, height) < MIN_OPEN_GRAPH_IMAGE_SHORTEST_SIDE_PX) {
    problems.push(
      `${quotedFilePath} is smaller than the ${MIN_OPEN_GRAPH_IMAGE_SHORTEST_SIDE_PX}px minimum on its shortest side (${width}x${height}px).`,
    );
  }

  if (bytes > MAX_OPEN_GRAPH_IMAGE_BYTES) {
    problems.push(`${quotedFilePath} exceeds the ${fileSize(MAX_OPEN_GRAPH_IMAGE_BYTES)} limit (${fileSize(bytes)}).`);
  }

  return problems;
}

export function entryIconProblems({
  path,
  isOpaque,
  hasViewBox,
}: Pick<ResolvedEntryIcon, "path" | "isOpaque" | "hasViewBox">): Array<string> {
  const quotedFilePath = quotedContentPath(path);
  return [
    ...(isOpaque ? [`${quotedFilePath} is opaque. Remove its background.`] : []),
    ...(hasViewBox ? [] : [`${quotedFilePath} has no \`viewBox\` attribute on its root \`<svg>\`.`]),
  ];
}

export function videoProblems({
  path,
  bytes,
  mp4Metadata,
}: Pick<ResolvedVideo, "path" | "bytes" | "mp4Metadata">): Array<string> {
  const quotedFilePath = quotedContentPath(path);

  if (bytes > MAX_RENDITION_BYTES) {
    return [
      `${quotedFilePath} exceeds the ${fileSize(MAX_RENDITION_BYTES)} video limit (${fileSize(bytes)}). ${REENCODE_VIDEO_REMEDY}`,
    ];
  }

  if (!mp4Metadata) {
    return [`${quotedFilePath} is not an MP4 file. ${REENCODE_VIDEO_REMEDY}`];
  }

  const problems: Array<string> = [];
  const unsupportedSampleFormats = mp4Metadata.sampleFormats.filter(
    (format) => format !== H264_SAMPLE_FORMAT && format !== AAC_SAMPLE_FORMAT,
  );

  if (unsupportedSampleFormats.length > 0) {
    problems.push(
      `${quotedFilePath} contains unsupported formats (${unsupportedSampleFormats.join(", ")}). ${REENCODE_VIDEO_REMEDY}`,
    );
  }

  // Dimensions and box order require a video track.
  if (!mp4Metadata.sampleFormats.includes(H264_SAMPLE_FORMAT)) {
    problems.push(`${quotedFilePath} has no H.264 video track. ${REENCODE_VIDEO_REMEDY}`);
    return problems;
  }

  if (!mp4Metadata.dimensions) {
    problems.push(`${quotedFilePath} has an unknown render size (no display dimensions declared).`);
  }

  if (!mp4Metadata.movieBoxPrecedesMediaData) {
    problems.push(`${quotedFilePath}'s \`moov\` box must precede its \`mdat\` box. ${REENCODE_VIDEO_REMEDY}`);
  }

  return problems;
}

export function posterImageProblems(
  posterImage: Pick<ResolvedImage, "path" | "dimensions">,
  video: { path: string; dimensions: Dimensions },
): Array<string> {
  const ratio = aspectRatioOf(posterImage.dimensions);
  const videoRatio = aspectRatioOf(video.dimensions);

  if (Math.abs(ratio - videoRatio) <= videoRatio * ASPECT_RATIO_TOLERANCE) {
    return [];
  }

  return [
    `${quotedContentPath(posterImage.path)} (${ratio.toFixed(2)}) must match the aspect ratio of ${quotedContentPath(video.path)} (${videoRatio.toFixed(2)}).`,
  ];
}

export function imageMetadataProblems({
  path,
  embeddedMetadataNames,
}: Pick<ResolvedImage, "path" | "embeddedMetadataNames">): Array<string> {
  if (embeddedMetadataNames.length === 0) {
    return [];
  }

  const metadataNameList = embeddedMetadataNames.join(", ");
  const remedy = isEncodableImage(path)
    ? "Strip it with `npm run optimize-image`."
    : "Strip it before committing the image.";

  return [`${quotedContentPath(path)} contains embedded metadata (${metadataNameList}). ${remedy}`];
}

export function renditionSizeProblems(rendition: MediaRendition, bytes: number): Array<string> {
  if (bytes <= MAX_RENDITION_BYTES) {
    return [];
  }

  const quotedRenditionPath = `"${rootRelativePathOf(rendition)}"`;
  const quotedServedFilePath =
    rendition.origin === "derivative"
      ? `${quotedRenditionPath}, encoded from ${quotedContentPath(rendition.resolvedMediaFile.path)},`
      : quotedRenditionPath;

  return [`${quotedServedFilePath} exceeds the ${fileSize(MAX_RENDITION_BYTES)} limit (${fileSize(bytes)}).`];
}

export const contentMediaProblemReport = (problems: Array<string>) =>
  `Content media failed validation:\n- ${problems.join("\n- ")}`;
