import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";
import { isEntryFile } from "#/lib/content/entry-file.ts";
import type { MediaKind } from "#/lib/content/media.ts";

import { quotedContentPath } from "../../paths.ts";
import { URL_SAFE_NAME, listedEntriesIn, readContentListing } from "../listing.ts";
import { mediaDirectoryFileNameOf } from "../markup/media-references.ts";

import {
  COVER_IMAGE_STEM_SUFFIX,
  ENTRY_ICON_STEM_SUFFIX,
  VIDEO_POSTER_IMAGE_STEM_SUFFIX,
  authoredExtensionOf,
  isContentMedia,
  isEncodableImage,
  isImage,
  isSupportedCoverImage,
  isSupportedEntryIcon,
  isVideo,
  posterImageStemOf,
  withoutExtension,
} from "./formats.ts";

import type { ContentDirectoryListing, ContentListing, ListedEntry } from "../listing.ts";
import type { MediaReference } from "../markup/media-references.ts";

/** A video in an entry's media directory, and the poster image paired with it by name. */
export interface AuthoredVideo {
  videoFileName: string;
  /** `null` unless exactly one poster image, in an encodable format, is named after the video. */
  posterImageFileName: string | null;
}

export interface AuthoredEntryMedia extends ListedEntry {
  /** Relative to the content directory. */
  coverImageFilePath: string | null;
  /** Relative to the content directory. */
  entryIconFilePath: string | null;
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
const isPosterImageFileName = (fileName: string) => withoutExtension(fileName).endsWith(VIDEO_POSTER_IMAGE_STEM_SUFFIX);
const isNamedAfter = (fileName: string, stem: string) => withoutExtension(fileName) === stem;
const withIndefiniteArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;

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

interface SiblingImageKind {
  /** The singular noun the problems use for an image of this kind. */
  noun: string;
  stemSuffix: string;
  isSupported: (fileName: string) => boolean;
}

const COVER_IMAGE_KIND: SiblingImageKind = {
  noun: "cover image",
  stemSuffix: COVER_IMAGE_STEM_SUFFIX,
  isSupported: isSupportedCoverImage,
};
const ENTRY_ICON_KIND: SiblingImageKind = {
  noun: "entry icon",
  stemSuffix: ENTRY_ICON_STEM_SUFFIX,
  isSupported: isSupportedEntryIcon,
};
const SIBLING_IMAGE_KINDS = [COVER_IMAGE_KIND, ENTRY_ICON_KIND];

const stemSuffixPositionIn = (fileName: string, { stemSuffix }: SiblingImageKind) =>
  fileName.lastIndexOf(`${stemSuffix}.`);

/**
 * Matches a file name with the stem suffix of `kind`, unless another kind's stem suffix follows it (e.g.,
 * `entry.cover.icon.svg` is an entry icon).
 */
function isSiblingImageFileName(fileName: string, kind: SiblingImageKind) {
  const stemSuffixPosition = stemSuffixPositionIn(fileName, kind);
  return (
    !isEntryFile(fileName) &&
    stemSuffixPosition !== -1 &&
    SIBLING_IMAGE_KINDS.every(
      (otherKind) => otherKind === kind || stemSuffixPositionIn(fileName, otherKind) < stemSuffixPosition,
    )
  );
}

const isSiblingImageOf = (fileName: string, slug: string, { stemSuffix }: SiblingImageKind) =>
  isNamedAfter(fileName, `${slug}${stemSuffix}`);

/** Finds the image of `kind` named after the entry with `slug` among a directory's images of that kind. */
function siblingImageOf(
  directoryName: string,
  slug: string,
  directorySiblingImageFileNames: Array<string>,
  kind: SiblingImageKind,
) {
  const { noun, isSupported } = kind;
  const siblingImageFileNames = directorySiblingImageFileNames.filter((fileName) =>
    isSiblingImageOf(fileName, slug, kind),
  );
  const [siblingImageFileName] = siblingImageFileNames;
  const problems = [
    ...(siblingImageFileNames.length > 1
      ? [
          `${quotedContentPath(directoryName)} contains multiple ${noun}s for ${slug}: ${siblingImageFileNames.join(", ")}.`,
        ]
      : []),
    ...siblingImageFileNames
      .filter((fileName) => !isSupported(fileName))
      .map(
        (fileName) =>
          `The image format of ${quotedContentPath(directoryName, fileName)} is not supported for ${noun}s.`,
      ),
    ...siblingImageFileNames
      .filter((fileName) => !isUrlSafeFileName(fileName))
      .map((fileName) => `${quotedContentPath(directoryName, fileName)} has a URL-unsafe file name.`),
  ];
  const isAssignable =
    siblingImageFileNames.length === 1 && siblingImageFileName !== undefined && isSupported(siblingImageFileName);

  return { filePath: isAssignable ? `${directoryName}/${siblingImageFileName}` : null, problems };
}

/** Reports each image of `kind` in a directory without a corresponding entry. */
function orphanSiblingImageProblems(
  directoryName: string,
  listedEntries: Array<ListedEntry>,
  directorySiblingImageFileNames: Array<string>,
  kind: SiblingImageKind,
) {
  return directorySiblingImageFileNames
    .filter((fileName) => !listedEntries.some(({ slug }) => isSiblingImageOf(fileName, slug, kind)))
    .map(
      (fileName) =>
        `${quotedContentPath(directoryName, fileName)} is ${withIndefiniteArticle(kind.noun)} without a corresponding entry.`,
    );
}

export function authoredMediaIn(directoryListing: ContentDirectoryListing): AuthoredMedia {
  const { directoryName, fileNames, fileNamesBySubdirectoryName } = directoryListing;
  const coverImageFileNames = fileNames.filter((fileName) => isSiblingImageFileName(fileName, COVER_IMAGE_KIND));
  const siblingEntryIconFileNames = fileNames.filter((fileName) => isSiblingImageFileName(fileName, ENTRY_ICON_KIND));
  const isPagesDirectory = directoryName === PAGES_DIRECTORY_NAME;
  const entryIconFileNames = isPagesDirectory ? [] : siblingEntryIconFileNames;
  const pageEntryIconFileNames = isPagesDirectory ? siblingEntryIconFileNames : [];
  const listedEntries = listedEntriesIn(directoryListing);
  const entries = listedEntries.map((listedEntry) => {
    const { slug, mediaDirectoryPath } = listedEntry;
    const mediaFileNames = fileNamesBySubdirectoryName[slug] ?? [];
    const imageFileNames = mediaFileNames.filter(isImage);
    const videoFileNames = mediaFileNames.filter(isVideo);
    const { videos, problems: videoProblems } = authoredVideosIn(mediaDirectoryPath, imageFileNames, videoFileNames);
    const { filePath: coverImageFilePath, problems: coverImageProblems } = siblingImageOf(
      directoryName,
      slug,
      coverImageFileNames,
      COVER_IMAGE_KIND,
    );
    const { filePath: entryIconFilePath, problems: entryIconProblems } = siblingImageOf(
      directoryName,
      slug,
      entryIconFileNames,
      ENTRY_ICON_KIND,
    );
    const problems = [
      ...mediaFileNames
        .filter((fileName) => !isContentMedia(fileName))
        .map(
          (fileName) => `${quotedContentPath(mediaDirectoryPath, fileName)} is not a supported image or video format.`,
        ),
      ...videoProblems,
      ...coverImageProblems,
      ...entryIconProblems,
      ...[...imageFileNames, ...videoFileNames]
        .filter((fileName) => !isUrlSafeFileName(fileName))
        .map((fileName) => `${quotedContentPath(mediaDirectoryPath, fileName)} has a URL-unsafe file name.`),
    ];
    const entryMedia: AuthoredEntryMedia = {
      ...listedEntry,
      coverImageFilePath,
      entryIconFilePath,
      bodyImageFileNames: imageFileNames.filter((fileName) => !isPosterImageFileName(fileName)),
      videos,
    };

    return { entryMedia, problems };
  });

  return {
    entryMedia: entries.map(({ entryMedia }) => entryMedia),
    problems: [
      ...entries.flatMap(({ problems }) => problems),
      ...orphanSiblingImageProblems(directoryName, listedEntries, coverImageFileNames, COVER_IMAGE_KIND),
      ...orphanSiblingImageProblems(directoryName, listedEntries, entryIconFileNames, ENTRY_ICON_KIND),
      ...pageEntryIconFileNames.map(
        (fileName) =>
          `${quotedContentPath(directoryName, fileName)} is an entry icon beside a page, and only a collection list renders entry icons.`,
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
        `${quotedContentPath(entryFilePath)} references "${reference}", which is ${withIndefiniteArticle(kind)}, where only ${withIndefiniteArticle(expected)} can be rendered.`,
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
