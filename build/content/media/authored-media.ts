import { isEntryFile } from "#/lib/content/entry-file.ts";
import type { MediaKind } from "#/lib/content/media.ts";

import { quotedContentPath } from "../../paths.ts";
import { URL_SAFE_NAME, listedEntriesIn, readContentListing } from "../listing.ts";
import { mediaDirectoryFileNameOf } from "../markup/media-references.ts";

import {
  COVER_IMAGE_STEM_SUFFIX,
  VIDEO_POSTER_IMAGE_STEM_SUFFIX,
  authoredExtensionOf,
  coverImageStemOf,
  isContentMedia,
  isEncodableImage,
  isImage,
  isVideo,
  posterImageStemOf,
  withoutExtension,
} from "./formats.ts";

import type { ContentDirectoryListing, ContentListing, ListedEntry } from "../listing.ts";
import type { MediaReference } from "../markup/media-references.ts";

/** A video in an entry's media directory, and the poster image paired with it by name. */
export interface AuthoredVideo {
  videoFileName: string;
  posterImageFileName: string | null; // `null` unless exactly one poster image, in an encodable format, is named after the video.
}

export interface AuthoredEntryMedia extends ListedEntry {
  coverImageFilePath: string | null; // Relative to the content directory.
  bodyImageFileNames: Array<string>;
  videos: Array<AuthoredVideo>;
}

interface AuthoredMedia {
  entryMedia: Array<AuthoredEntryMedia>;
  problems: Array<string>;
}

function isUrlSafeFileName(fileName: string) {
  const extension = authoredExtensionOf(fileName);
  return (
    extension !== "" &&
    extension === extension.toLowerCase() &&
    withoutExtension(fileName)
      .split(".")
      .every((part) => URL_SAFE_NAME.test(part))
  );
}

const isNamedAfter = (fileName: string, stem: string) => withoutExtension(fileName) === stem;
const isCoverImageFileName = (fileName: string) =>
  !isEntryFile(fileName) && fileName.includes(`${COVER_IMAGE_STEM_SUFFIX}.`);
const isPosterImageFileName = (fileName: string) => withoutExtension(fileName).endsWith(VIDEO_POSTER_IMAGE_STEM_SUFFIX);
const kindWithIndefiniteArticle = (kind: MediaKind) => `${kind === "image" ? "an" : "a"} ${kind}`;

function authoredVideosIn(mediaDirectoryPath: string, imageFileNames: Array<string>, videoFileNames: Array<string>) {
  const problems: Array<string> = [];
  const videos = videoFileNames.map((videoFileName): AuthoredVideo => {
    const candidatePosterImageFileNames = imageFileNames.filter((fileName) =>
      isNamedAfter(fileName, posterImageStemOf(videoFileName)),
    );
    const [posterImageFileName, ...otherPosterImageFileNames] = candidatePosterImageFileNames;
    const quotedVideoPath = quotedContentPath(mediaDirectoryPath, videoFileName);

    if (otherPosterImageFileNames.length > 0) {
      problems.push(`${quotedVideoPath} has more than one poster image: ${candidatePosterImageFileNames.join(", ")}.`);
    } else if (posterImageFileName === undefined) {
      problems.push(`${quotedVideoPath} has no poster image.`);
    } else if (!isEncodableImage(posterImageFileName)) {
      problems.push(
        `The image format of ${quotedContentPath(mediaDirectoryPath, posterImageFileName)} is not supported for poster images.`,
      );
    } else {
      return { videoFileName, posterImageFileName };
    }

    return { videoFileName, posterImageFileName: null };
  });
  const posterImageStems = new Set(videoFileNames.map(posterImageStemOf));
  const orphanPosterImageFileNames = imageFileNames.filter(
    (fileName) => isPosterImageFileName(fileName) && !posterImageStems.has(withoutExtension(fileName)),
  );

  for (const fileName of orphanPosterImageFileNames) {
    problems.push(
      `${quotedContentPath(mediaDirectoryPath, fileName)} is named as a poster image, but it has no corresponding video.`,
    );
  }

  return { videos, problems };
}

/** Finds the cover image named after the entry with `slug` among a directory's cover images. */
function coverImageOf(directoryName: string, slug: string, directoryCoverImageFileNames: Array<string>) {
  const coverImageFileNames = directoryCoverImageFileNames.filter((fileName) =>
    isNamedAfter(fileName, coverImageStemOf(slug)),
  );
  const [coverImageFileName] = coverImageFileNames;
  const problems = [
    ...(coverImageFileNames.length > 1
      ? [
          `${quotedContentPath(directoryName)} contains multiple cover images for ${slug}: ${coverImageFileNames.join(", ")}.`,
        ]
      : []),
    ...coverImageFileNames
      .filter((fileName) => !isEncodableImage(fileName))
      .map(
        (fileName) =>
          `The image format of ${quotedContentPath(directoryName, fileName)} is not supported for cover images.`,
      ),
    ...coverImageFileNames
      .filter((fileName) => !isUrlSafeFileName(fileName))
      .map((fileName) => `${quotedContentPath(directoryName, fileName)} has a URL-unsafe file name.`),
  ];
  const isAssignable =
    coverImageFileNames.length === 1 && coverImageFileName !== undefined && isEncodableImage(coverImageFileName);

  return { coverImageFilePath: isAssignable ? `${directoryName}/${coverImageFileName}` : null, problems };
}

export function authoredMediaIn(directoryListing: ContentDirectoryListing): AuthoredMedia {
  const { directoryName, fileNames, fileNamesBySubdirectoryName } = directoryListing;
  const coverImageFileNames = fileNames.filter(isCoverImageFileName);
  const listedEntries = listedEntriesIn(directoryListing);

  const entries = listedEntries.map((listedEntry) => {
    const { slug, mediaDirectoryPath } = listedEntry;
    const mediaFileNames = fileNamesBySubdirectoryName[slug] ?? [];
    const imageFileNames = mediaFileNames.filter(isImage);
    const videoFileNames = mediaFileNames.filter(isVideo);
    const { videos, problems: videoProblems } = authoredVideosIn(mediaDirectoryPath, imageFileNames, videoFileNames);
    const { coverImageFilePath, problems: coverImageProblems } = coverImageOf(directoryName, slug, coverImageFileNames);
    const problems = [
      ...mediaFileNames
        .filter((fileName) => !isContentMedia(fileName))
        .map(
          (fileName) => `${quotedContentPath(mediaDirectoryPath, fileName)} is not a supported image or video format.`,
        ),
      ...videoProblems,
      ...coverImageProblems,
      ...[...imageFileNames, ...videoFileNames]
        .filter((fileName) => !isUrlSafeFileName(fileName))
        .map((fileName) => `${quotedContentPath(mediaDirectoryPath, fileName)} has a URL-unsafe file name.`),
    ];
    const entryMedia: AuthoredEntryMedia = {
      ...listedEntry,
      coverImageFilePath,
      bodyImageFileNames: imageFileNames.filter((fileName) => !isPosterImageFileName(fileName)),
      videos,
    };

    return { entryMedia, problems };
  });

  const orphanCoverImageFileNames = coverImageFileNames.filter(
    (fileName) => !listedEntries.some(({ slug }) => isNamedAfter(fileName, coverImageStemOf(slug))),
  );

  return {
    entryMedia: entries.map(({ entryMedia }) => entryMedia),
    problems: [
      ...entries.flatMap(({ problems }) => problems),
      ...orphanCoverImageFileNames.map(
        (fileName) => `${quotedContentPath(directoryName, fileName)} is a cover image without a corresponding entry.`,
      ),
    ],
  };
}

export function readAuthoredMedia(listing: ContentListing = readContentListing()): AuthoredMedia {
  const mediaInDirectories = listing.map(authoredMediaIn);
  return {
    entryMedia: mediaInDirectories.flatMap(({ entryMedia }) => entryMedia),
    problems: mediaInDirectories.flatMap(({ problems }) => problems),
  };
}

/** Reports invalid references and body media that is not referenced. */
export function mediaReferenceProblems(
  references: Array<MediaReference>,
  { entryFilePath, mediaDirectoryPath, bodyImageFileNames, videos }: AuthoredEntryMedia,
): Array<string> {
  const videoFileNames = videos.map(({ videoFileName }) => videoFileName);
  const posterImageFileNames = videos.flatMap(({ posterImageFileName }) => posterImageFileName ?? []);
  const kindsByFileName = new Map<string, MediaKind>([
    ...[...bodyImageFileNames, ...posterImageFileNames].map((fileName) => [fileName, "image"] as const),
    ...videoFileNames.map((fileName) => [fileName, "video"] as const),
  ]);
  const problems: Array<string> = [];
  const referencedFileNames = new Set<string>();

  for (const { reference, expected } of references) {
    const fileName = mediaDirectoryFileNameOf(reference);
    const kind = fileName === null ? undefined : kindsByFileName.get(fileName);

    if (fileName === null || !kind) {
      problems.push(
        `${quotedContentPath(entryFilePath)} references "${reference}", which is not a file in ${quotedContentPath(`${mediaDirectoryPath}/`)}.`,
      );
      continue;
    }

    referencedFileNames.add(fileName);

    if (expected && kind !== expected) {
      problems.push(
        `${quotedContentPath(entryFilePath)} references "${reference}", which is ${kindWithIndefiniteArticle(kind)}, where only ${kindWithIndefiniteArticle(expected)} can be rendered.`,
      );
    }
  }

  const unreferencedFileNames = [...bodyImageFileNames, ...videoFileNames]
    .filter((fileName) => !referencedFileNames.has(fileName))
    .sort();

  for (const unreferencedFileName of unreferencedFileNames) {
    problems.push(
      `${quotedContentPath(mediaDirectoryPath, unreferencedFileName)} is not referenced by ${quotedContentPath(entryFilePath)}.`,
    );
  }

  return problems;
}
