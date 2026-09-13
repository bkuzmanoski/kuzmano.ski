import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import type { EntryKey } from "#/lib/content/entry-file.ts";
import type {
  ContentImage,
  ContentMedia,
  CoverImage,
  Dimensions,
  PictureSource,
  SizedMedia,
} from "#/lib/content/media.ts";
import { metricIn } from "#/lib/layout-metrics.ts";
import type { LayoutMetrics } from "#/lib/layout-metrics.ts";

import { readLayoutMetrics } from "../../stylesheet/layout-metrics.ts";
import { mediaDirectoryFileNameOf, mediaReferencesInSource } from "../markup/media-references.ts";

import { mediaReferenceProblems, readAuthoredMedia } from "./authored-media.ts";
import {
  BODY_IMAGE_DERIVATIVES,
  POSTER_IMAGE_DERIVATIVE,
  imageDerivativeDimensionsOf,
  thumbnailImageDerivativesFor,
} from "./derivatives.ts";
import { isSourceImage } from "./formats.ts";
import {
  coverImageProblems,
  imageMetadataProblems,
  posterImageProblems,
  renditionSizeProblems,
  videoProblems,
} from "./problems.ts";
import { authoredRendition, imageDerivativeRendition } from "./renditions.ts";
import { createMediaFileReader } from "./resolved-media.ts";

import type { AuthoredEntryMedia, AuthoredVideo } from "./authored-media.ts";
import type { ImageDerivative } from "./derivatives.ts";
import type { MediaRendition } from "./renditions.ts";
import type { MediaFileReader, ResolvedImage } from "./resolved-media.ts";
import type { MediaReference } from "../markup/media-references.ts";
import type { MediaForReference } from "../markup/media-rewrite.ts";

export interface MediaIndex {
  coverImageSize: number;
  coverImages: Record<EntryKey, CoverImage>;
  renditionsByUrl: Map<string, MediaRendition>;
  entryAbsolutePathsByMediaDirectoryPath: Map<string, string>;
  mediaForEntry: (absolutePath: string) => MediaForReference;
  recheckReferences: (absolutePath: string, source: string) => boolean; // Replaces an entry's reference problems with those of its edited source. Returns `false` when an index needs to be rebuilt.
  problems: () => Array<string>;
}

// Index data contributed by a media file or video-poster pair.
interface BodyMediaResolution {
  mediaByFileName: Array<[fileName: string, media: ContentMedia]>; // A reference names the media by its file name.
  renditions: Array<MediaRendition>;
  problems: Array<string>;
}

interface ResolvedEntryMedia {
  entry: AuthoredEntryMedia;
  coverImage: CoverImage | null;
  mediaByFileName: Map<string, ContentMedia>;
  alternateImageFileNames: Set<string>;
  renditions: Array<MediaRendition>;
  mediaProblems: Array<string>;
  referenceProblems: Array<string>; // Replaced when the entry's source is rechecked.
}

export const coverImageSizeIn = (layoutMetrics: LayoutMetrics) => metricIn(layoutMetrics, "coverImageSize");

const pictureSourceOf = ({ url, type }: MediaRendition): PictureSource => ({ srcSet: url, type });
const sizedMediaOf = ({ url }: MediaRendition, dimensions: Dimensions): SizedMedia => ({ src: url, ...dimensions });

function alternateImageFileNamesIn(
  references: Array<MediaReference>,
  { bodyImageFileNames }: AuthoredEntryMedia,
): Set<string> {
  const referencedFileNames = new Set(
    references.flatMap(({ reference, rendersAlternates }) =>
      rendersAlternates ? (mediaDirectoryFileNameOf(reference) ?? []) : [],
    ),
  );
  return new Set(bodyImageFileNames.filter((fileName) => isSourceImage(fileName) && referencedFileNames.has(fileName)));
}

function pictureOf(
  image: ResolvedImage,
  fallbackRendition: MediaRendition,
  fallbackDimensions: Dimensions,
  alternateDerivatives: Array<ImageDerivative>,
): { picture: ContentImage; renditions: Array<MediaRendition> } {
  const alternateRenditions = alternateDerivatives.map((derivative) => imageDerivativeRendition(image, derivative));
  return {
    picture: {
      kind: "image",
      ...sizedMediaOf(fallbackRendition, fallbackDimensions),
      alternates: alternateRenditions.map(pictureSourceOf),
    },
    renditions: [fallbackRendition, ...alternateRenditions],
  };
}

export async function buildMediaIndex(reader: MediaFileReader = createMediaFileReader()): Promise<MediaIndex> {
  const coverImageSize = coverImageSizeIn(await readLayoutMetrics());
  const thumbnailDerivatives = thumbnailImageDerivativesFor(coverImageSize * 2); // Twice the width it is rendered at for high-density displays.
  const { entryMedia, problems: authoredMediaProblems } = readAuthoredMedia();

  async function resolveCoverImage(coverImageFilePath: string) {
    const coverImage = await reader.readImage(coverImageFilePath);

    if ("problem" in coverImage) {
      return { coverImage: null, renditions: [], problems: [coverImage.problem] };
    }

    const socialImageRendition = authoredRendition(coverImage);
    const thumbnail = pictureOf(
      coverImage,
      imageDerivativeRendition(coverImage, thumbnailDerivatives.fallback),
      imageDerivativeDimensionsOf(coverImage.dimensions, thumbnailDerivatives.fallback),
      thumbnailDerivatives.alternates,
    );

    return {
      coverImage: { social: sizedMediaOf(socialImageRendition, coverImage.dimensions), thumbnail: thumbnail.picture },
      renditions: [socialImageRendition, ...thumbnail.renditions],
      problems: [...coverImageProblems(coverImage), ...imageMetadataProblems(coverImage)],
    };
  }

  async function resolveBodyImage(
    mediaDirectoryPath: string,
    fileName: string,
    hasAlternates: boolean,
  ): Promise<BodyMediaResolution> {
    const bodyImage = await reader.readImage(`${mediaDirectoryPath}/${fileName}`);

    if ("problem" in bodyImage) {
      return { mediaByFileName: [], renditions: [], problems: [bodyImage.problem] };
    }

    const bodyImageRendition = authoredRendition(bodyImage);
    const { picture, renditions } = pictureOf(
      bodyImage,
      bodyImageRendition,
      bodyImage.dimensions,
      hasAlternates ? BODY_IMAGE_DERIVATIVES : [],
    );

    return {
      mediaByFileName: [[fileName, picture]],
      renditions,
      problems: [...imageMetadataProblems(bodyImage), ...renditionSizeProblems(bodyImageRendition, bodyImage.bytes)],
    };
  }

  async function resolveVideo(
    mediaDirectoryPath: string,
    { videoFileName, posterImageFileName }: AuthoredVideo,
  ): Promise<BodyMediaResolution> {
    const [posterImage, video] = await Promise.all([
      posterImageFileName === null ? null : reader.readImage(`${mediaDirectoryPath}/${posterImageFileName}`),
      reader.readVideo(`${mediaDirectoryPath}/${videoFileName}`),
    ]);
    const videoRendition = authoredRendition(video);
    const problems = videoProblems(video);

    if (posterImageFileName === null || posterImage === null) {
      return { mediaByFileName: [], renditions: [videoRendition], problems };
    }

    if ("problem" in posterImage) {
      return { mediaByFileName: [], renditions: [videoRendition], problems: [posterImage.problem, ...problems] };
    }

    const posterImageRendition = imageDerivativeRendition(posterImage, POSTER_IMAGE_DERIVATIVE);
    const posterImageMedia = sizedMediaOf(posterImageRendition, posterImage.dimensions);
    const renditions = [videoRendition, posterImageRendition];
    const posterImageEntry: [string, ContentMedia] = [
      posterImageFileName,
      { kind: "image", ...posterImageMedia, alternates: [] },
    ];
    const videoDimensions = video.mp4Metadata?.dimensions;

    if (!videoDimensions) {
      return { mediaByFileName: [posterImageEntry], renditions, problems }; // `videoProblems` reports this; rendering requires dimensions.
    }

    return {
      mediaByFileName: [
        posterImageEntry,
        [
          videoFileName,
          { kind: "video", ...sizedMediaOf(videoRendition, videoDimensions), posterImage: posterImageMedia },
        ],
      ],
      renditions,
      problems: [...problems, ...posterImageProblems(posterImage, { path: video.path, dimensions: videoDimensions })],
    };
  }

  async function resolveBodyMedia(entry: AuthoredEntryMedia) {
    const { absolutePath, mediaDirectoryPath, bodyImageFileNames, videos } = entry;
    const references = mediaReferencesInSource(await readFile(absolutePath, "utf8"));
    const alternateImageFileNames = alternateImageFileNamesIn(references, entry);
    const resolutions = await Promise.all([
      ...bodyImageFileNames.map((fileName) =>
        resolveBodyImage(mediaDirectoryPath, fileName, alternateImageFileNames.has(fileName)),
      ),
      ...videos.map((video) => resolveVideo(mediaDirectoryPath, video)),
    ]);

    return { resolutions, alternateImageFileNames, referenceProblems: mediaReferenceProblems(references, entry) };
  }

  async function resolveEntryMedia(entry: AuthoredEntryMedia): Promise<ResolvedEntryMedia> {
    const { coverImageFilePath } = entry;
    const [coverImageResolution, { resolutions: bodyMediaResolutions, alternateImageFileNames, referenceProblems }] =
      await Promise.all([
        coverImageFilePath === null ? null : resolveCoverImage(coverImageFilePath),
        resolveBodyMedia(entry),
      ]);

    return {
      entry,
      coverImage: coverImageResolution?.coverImage ?? null,
      mediaByFileName: new Map(bodyMediaResolutions.flatMap(({ mediaByFileName }) => mediaByFileName)),
      alternateImageFileNames,
      renditions: [
        ...(coverImageResolution?.renditions ?? []),
        ...bodyMediaResolutions.flatMap(({ renditions }) => renditions),
      ],
      mediaProblems: [
        ...(coverImageResolution?.problems ?? []),
        ...bodyMediaResolutions.flatMap(({ problems }) => problems),
      ],
      referenceProblems,
    };
  }

  const resolvedEntries = await Promise.all(entryMedia.map(resolveEntryMedia));
  const resolvedEntriesByAbsolutePath = new Map(
    resolvedEntries.map((resolved) => [resolved.entry.absolutePath, resolved]),
  );
  const coverImages: Record<EntryKey, CoverImage> = {};
  const renditionsByUrl = new Map<string, MediaRendition>();

  for (const { entry, coverImage, renditions } of resolvedEntries) {
    if (coverImage) {
      coverImages[entry.key] = coverImage;
    }

    renditions.forEach((rendition) => renditionsByUrl.set(rendition.url, rendition));
  }

  return {
    coverImageSize,
    coverImages,
    renditionsByUrl,
    entryAbsolutePathsByMediaDirectoryPath: new Map(
      entryMedia.map(({ mediaDirectoryPath, absolutePath }) => [mediaDirectoryPath, absolutePath]),
    ),
    mediaForEntry(absolutePath) {
      const mediaByFileName = resolvedEntriesByAbsolutePath.get(absolutePath)?.mediaByFileName;

      return (reference) => {
        const fileName = mediaDirectoryFileNameOf(reference);

        return fileName === null ? null : (mediaByFileName?.get(fileName) ?? null);
      };
    },
    recheckReferences(absolutePath, source) {
      const resolvedEntry = resolvedEntriesByAbsolutePath.get(absolutePath);

      if (!resolvedEntry) {
        return true;
      }

      const references = mediaReferencesInSource(source);

      resolvedEntry.referenceProblems = mediaReferenceProblems(references, resolvedEntry.entry);

      return isDeepStrictEqual(
        alternateImageFileNamesIn(references, resolvedEntry.entry),
        resolvedEntry.alternateImageFileNames,
      );
    },
    problems: () => [
      ...authoredMediaProblems,
      ...resolvedEntries.flatMap(({ mediaProblems, referenceProblems }) => [...mediaProblems, ...referenceProblems]),
    ],
  };
}
