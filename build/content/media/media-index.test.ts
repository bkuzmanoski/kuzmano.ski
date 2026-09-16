import { describe, expect, test, vi } from "vitest";

import { mediaRoute } from "#/lib/content/paths.ts";

import { CONTENT_DIRECTORY_PATH, fromContent } from "../../paths.ts";
import { listedEntry } from "../../test-utils/listing.ts";
import {
  BODY_IMAGE_FILE_PATH,
  COVER_IMAGE_FILE_PATH,
  ENTRY_ABSOLUTE_PATH,
  ENTRY_SOURCE,
  MEDIA_FILE_HASH,
  POSTER_IMAGE_FILE_PATH,
  VIDEO_DIMENSIONS,
  VIDEO_FILE_NAME,
  authoredEntryMedia,
  resolvedImage,
  resolvedVideo,
} from "../../test-utils/media.ts";

import { buildMediaIndex } from "./media-index.ts";
import { MAX_RENDITION_BYTES, fileSize } from "./problems.ts";

import type * as authoredMedia from "./authored-media.ts";
import type { AuthoredEntryMedia } from "./authored-media.ts";
import type { MediaFileReader, ResolvedImage, ResolvedVideo, UnreadableImage } from "./resolved-media.ts";

const { readAuthoredMedia, readFile, readLayoutMetrics } = vi.hoisted(() => ({
  readAuthoredMedia: vi.fn(),
  readFile: vi.fn(),
  readLayoutMetrics: vi.fn(),
}));

vi.mock("./authored-media.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof authoredMedia>()),
  readAuthoredMedia,
}));
vi.mock("../../stylesheet/layout-metrics.ts", () => ({ readLayoutMetrics }));
vi.mock("node:fs/promises", () => ({ default: { readFile }, readFile }));

const ENTRY = authoredEntryMedia();
const AUTHORED_COVER_IMAGE_DIMENSIONS = { width: 1200, height: 630 };
const RENDERED_COVER_IMAGE_SIZE = 64;
const SOURCE_WITH_IMAGE_IN_PICTURE = `<picture>
  <img src="./image.png" alt="An image" />
</picture>

<video src="./video.mp4" />
`;
const VIDEO_WITHOUT_POSTER_IMAGE = { videoFileName: VIDEO_FILE_NAME, posterImageFileName: null };
const HASHED_URL = /\.[0-9a-f]{16}\./;

interface ContentFixture {
  coverImageSize?: number;
  entryMedia?: Array<AuthoredEntryMedia>;
  problems?: Array<string>;
  source?: string;
  images?: Record<string, ResolvedImage | UnreadableImage>;
  video?: ResolvedVideo;
  reader?: MediaFileReader;
}

function indexOf({
  coverImageSize = RENDERED_COVER_IMAGE_SIZE,
  entryMedia = [ENTRY],
  problems = [],
  source = ENTRY_SOURCE,
  images = {},
  video,
  reader,
}: ContentFixture = {}) {
  const resolvedImages: Record<string, ResolvedImage | UnreadableImage> = {
    [COVER_IMAGE_FILE_PATH]: resolvedImage({
      path: COVER_IMAGE_FILE_PATH,
      dimensions: AUTHORED_COVER_IMAGE_DIMENSIONS,
    }),
    [BODY_IMAGE_FILE_PATH]: resolvedImage(),
    [POSTER_IMAGE_FILE_PATH]: resolvedImage({ path: POSTER_IMAGE_FILE_PATH, dimensions: VIDEO_DIMENSIONS }),
    ...images,
  };

  readLayoutMetrics.mockResolvedValue({ coverImageSize });
  readAuthoredMedia.mockReturnValue({ entryMedia, problems });
  readFile.mockResolvedValue(source);

  return buildMediaIndex(
    reader ?? {
      readImage: (path) => Promise.resolve(resolvedImages[path]!),
      readVideo: (path) => Promise.resolve(video ?? resolvedVideo({ path })),
    },
  );
}

const mediaFor = (index: Awaited<ReturnType<typeof buildMediaIndex>>, reference: string) =>
  index.mediaForEntry(ENTRY_ABSOLUTE_PATH)(reference);

describe("buildMediaIndex", () => {
  test("returns the layout metrics' cover image size", async () => {
    const { coverImageSize } = await indexOf();
    expect(coverImageSize).toBe(RENDERED_COVER_IMAGE_SIZE);
  });

  test("resolves a cover image to a social image at its authored URL and a WebP thumbnail whose shortest side is twice the cover image size with an AVIF alternate", async () => {
    const { coverImages } = await indexOf();
    const coverImage = coverImages[ENTRY.key]!;

    expect(coverImage.social).toEqual({
      src: mediaRoute(`collection/entry.cover.${MEDIA_FILE_HASH}.png`),
      ...AUTHORED_COVER_IMAGE_DIMENSIONS,
    });
    expect(coverImage.thumbnail).toMatchObject({
      kind: "image",
      width: 244, // The landscape cover image's width at twice the cover image size, rather than its shortest side.
      height: RENDERED_COVER_IMAGE_SIZE * 2,
    });
    expect(coverImage.thumbnail.src).toContain(mediaRoute("collection/entry.cover."));
    expect(coverImage.thumbnail.src).toMatch(/\.thumbnail\.webp$/);
    expect(coverImage.thumbnail.alternates).toHaveLength(1);
    expect(coverImage.thumbnail.alternates[0]?.type).toBe("image/avif");
    expect(coverImage.thumbnail.alternates[0]?.srcSet).toMatch(/\.thumbnail\.avif$/);
  });

  test("lists a problem for a cover image whose shortest side is below twice the cover image size, when that is larger than the social card minimum", async () => {
    const smallCoverImage = resolvedImage({ path: COVER_IMAGE_FILE_PATH, dimensions: { width: 800, height: 150 } });
    const index = await indexOf({ images: { [COVER_IMAGE_FILE_PATH]: smallCoverImage }, coverImageSize: 100 });

    expect(index.problems()).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" is smaller than the 200px minimum on its shortest side (800x150px).`,
    ]);
  });

  test("does not list a problem for a cover image whose shortest side is above the social card minimum, when that is larger than twice the cover image size", async () => {
    const smallCoverImage = resolvedImage({ path: COVER_IMAGE_FILE_PATH, dimensions: { width: 800, height: 150 } });
    const index = await indexOf({ images: { [COVER_IMAGE_FILE_PATH]: smallCoverImage } });

    expect(index.problems()).toEqual([]);
  });

  test("resolves a portrait cover image to a thumbnail whose width is twice the cover image size", async () => {
    const portraitCoverImage = resolvedImage({ path: COVER_IMAGE_FILE_PATH, dimensions: { width: 630, height: 1200 } });
    const { coverImages } = await indexOf({ images: { [COVER_IMAGE_FILE_PATH]: portraitCoverImage } });

    expect(coverImages[ENTRY.key]?.thumbnail).toMatchObject({ width: RENDERED_COVER_IMAGE_SIZE * 2, height: 244 });
  });

  test("resolves a cover image whose shortest side is below twice the cover image size to a thumbnail at its authored dimensions", async () => {
    const smallCoverImage = resolvedImage({ path: COVER_IMAGE_FILE_PATH, dimensions: { width: 200, height: 100 } });
    const { coverImages } = await indexOf({ images: { [COVER_IMAGE_FILE_PATH]: smallCoverImage } });

    expect(coverImages[ENTRY.key]?.thumbnail).toMatchObject({ width: 200, height: 100 });
  });

  test("resolves a body image reference to its authored URL with AVIF and WebP alternates", async () => {
    const index = await indexOf();
    const bodyImage = mediaFor(index, "./image.png");
    const alternates = bodyImage?.kind === "image" ? bodyImage.alternates : [];

    expect(bodyImage).toMatchObject({
      kind: "image",
      src: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.png`),
      width: 900,
      height: 500,
    });
    expect(alternates.map(({ type }) => type)).toEqual(["image/avif", "image/webp"]);
    expect(alternates.map(({ srcSet }) => srcSet.split(".").at(-1))).toEqual(["avif", "webp"]);
  });

  test("resolves a body image reference to its authored URL without alternates when its format is not encodable", async () => {
    const animationFilePath = "collection/entry/animation.gif";
    const index = await indexOf({
      entryMedia: [{ ...ENTRY, bodyImageFileNames: ["animation.gif"] }],
      images: { [animationFilePath]: resolvedImage({ path: animationFilePath }) },
      source: "![An animation](./animation.gif)\n",
    });

    expect(mediaFor(index, "./animation.gif")).toMatchObject({
      src: mediaRoute(animationFilePath).replace(".gif", `.${MEDIA_FILE_HASH}.gif`),
      alternates: [],
    });
  });

  test("resolves a body image referenced only inside an authored `<picture>` to its authored URL without alternates, and does not index derivative renditions of it", async () => {
    const index = await indexOf({ source: SOURCE_WITH_IMAGE_IN_PICTURE });
    const bodyImageUrls = [...index.renditionsByUrl.keys()].filter((url) =>
      url.startsWith(mediaRoute("collection/entry/image.")),
    );

    expect(mediaFor(index, "./image.png")).toMatchObject({ alternates: [] });
    expect(bodyImageUrls).toEqual([mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.png`)]);
  });

  test("lists a problem for a body image one byte over the maximum size", async () => {
    const index = await indexOf({
      images: { [BODY_IMAGE_FILE_PATH]: resolvedImage({ bytes: MAX_RENDITION_BYTES + 1 }) },
    });
    expect(index.problems()).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" exceeds the ${fileSize(MAX_RENDITION_BYTES)} limit (${fileSize(MAX_RENDITION_BYTES + 1)})`,
      ),
    ]);
  });

  test("lists a problem for metadata in a cover image and a body image, and ignores metadata in a poster image", async () => {
    const index = await indexOf({
      images: {
        [COVER_IMAGE_FILE_PATH]: resolvedImage({
          path: COVER_IMAGE_FILE_PATH,
          dimensions: { width: 512, height: 512 },
          embeddedMetadataNames: ["Exif"],
        }),
        [BODY_IMAGE_FILE_PATH]: resolvedImage({ embeddedMetadataNames: ["Exif"] }),
        [POSTER_IMAGE_FILE_PATH]: resolvedImage({
          path: POSTER_IMAGE_FILE_PATH,
          dimensions: VIDEO_DIMENSIONS,
          embeddedMetadataNames: ["Exif"],
        }),
      },
    });
    expect(index.problems()).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" contains embedded metadata`),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" contains embedded metadata`),
    ]);
  });

  test("lists an unreadable image's problem once, and still resolves the entry's other media", async () => {
    const index = await indexOf({
      images: {
        [BODY_IMAGE_FILE_PATH]: {
          problem: `"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" could not be read as an image.`,
        },
      },
    });

    expect(index.problems()).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" could not be read as an image.`,
    ]); // Unreadable images are reported once, not as missing references.
    expect(mediaFor(index, "./video.mp4")).not.toBeNull();
  });

  test("resolves a video reference to its authored URL with a WebP poster image", async () => {
    const index = await indexOf();
    const video = mediaFor(index, "./video.mp4");
    const posterImage = video?.kind === "video" ? video.posterImage : null;

    expect(video).toMatchObject({
      kind: "video",
      src: mediaRoute(`collection/entry/video.${MEDIA_FILE_HASH}.mp4`),
      ...VIDEO_DIMENSIONS,
    });
    expect(posterImage).toMatchObject(VIDEO_DIMENSIONS);
    expect(posterImage?.src).toContain(mediaRoute("collection/entry/video.poster."));
    expect(posterImage?.src).toMatch(/\.webp$/);
  });

  test("maps the URL of a video without a poster image to a rendition, and resolves the video reference to `null`", async () => {
    const index = await indexOf({ entryMedia: [{ ...ENTRY, videos: [VIDEO_WITHOUT_POSTER_IMAGE] }] });

    expect(index.renditionsByUrl.has(mediaRoute(`collection/entry/video.${MEDIA_FILE_HASH}.mp4`))).toBe(true);
    expect(mediaFor(index, "./video.mp4")).toBeNull();
  });

  test("lists a problem for a video without a poster image that is not an MP4", async () => {
    const index = await indexOf({
      entryMedia: [{ ...ENTRY, videos: [VIDEO_WITHOUT_POSTER_IMAGE] }],
      video: resolvedVideo({ mp4Metadata: null }),
    });

    expect(index.problems()).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" is not an MP4`),
    ]);
  });

  test("lists a single video problem for a video one byte over the maximum size", async () => {
    const index = await indexOf({ video: resolvedVideo({ bytes: MAX_RENDITION_BYTES + 1 }) });
    expect(index.problems()).toEqual([
      expect.stringContaining(
        `exceeds the ${fileSize(MAX_RENDITION_BYTES)} video limit (${fileSize(MAX_RENDITION_BYTES + 1)})`,
      ),
    ]);
  });

  test("maps every URL in the resolved media to a rendition", async () => {
    const index = await indexOf();
    const bodyImage = mediaFor(index, "./image.png");
    const video = mediaFor(index, "./video.mp4");
    const coverImage = index.coverImages[ENTRY.key]!;
    const urls = [
      coverImage.social.src,
      coverImage.thumbnail.src,
      ...coverImage.thumbnail.alternates.map(({ srcSet }) => srcSet),
      bodyImage!.src,
      ...(bodyImage?.kind === "image" ? bodyImage.alternates.map(({ srcSet }) => srcSet) : []),
      video!.src,
      ...(video?.kind === "video" ? [video.posterImage.src] : []),
    ];

    expect(urls.filter((url) => index.renditionsByUrl.has(url))).toEqual(urls);
  });

  test("does not map a poster image's authored URL to a rendition", async () => {
    const { renditionsByUrl } = await indexOf();
    expect(renditionsByUrl.has(mediaRoute(`collection/entry/video.poster.${MEDIA_FILE_HASH}.png`))).toBe(false);
  });

  test("resolves a reference into a subdirectory of the media directory to `null`", async () => {
    const index = await indexOf();
    expect(mediaFor(index, "./nested/image.png")).toBeNull();
  });

  test("resolves a reference from a file that is not an indexed entry to `null`", async () => {
    const index = await indexOf();
    expect(index.mediaForEntry(fromContent("collection/other-entry.mdx"))("./image.png")).toBeNull();
  });

  test("resolves a reference to a body image the indexed source does not reference, and lists a problem that the image is not referenced", async () => {
    const unusedImageFilePath = "collection/entry/unused.png";
    const index = await indexOf({
      entryMedia: [{ ...ENTRY, bodyImageFileNames: ["image.png", "unused.png"] }],
      images: { [unusedImageFilePath]: resolvedImage({ path: unusedImageFilePath }) },
    });

    expect(mediaFor(index, "./unused.png")?.src).toMatch(HASHED_URL);
    expect(index.problems()).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/unused.png" is not referenced`),
    ]);
  });

  test("replaces an entry's reference problems with those of the source it is rechecked against", async () => {
    const index = await indexOf({ source: `${ENTRY_SOURCE}\n![Missing](./missing.png)\n` });

    expect(index.problems()).toEqual([expect.stringMatching(/references "\.\/missing\.png"/)]);
    expect(index.recheckReferences(ENTRY_ABSOLUTE_PATH, ENTRY_SOURCE)).toEqual({ requiresRebuild: false });
    expect(index.problems()).toEqual([]);
  });

  test("does not require a rebuild when a rechecked source changes references but not which body images have alternates", async () => {
    const index = await indexOf();
    const source = `${ENTRY_SOURCE}
      <img src="./image.png" alt="An image" />
    `;

    expect(index.recheckReferences(ENTRY_ABSOLUTE_PATH, source)).toEqual({ requiresRebuild: false });
  });

  test("requires a rebuild, and retains the entry's reference problems, when a rechecked source changes which body images have alternates", async () => {
    const index = await indexOf();
    const source = `${SOURCE_WITH_IMAGE_IN_PICTURE}\n![Missing](./missing.png)\n`;

    expect(index.recheckReferences(ENTRY_ABSOLUTE_PATH, source)).toEqual({ requiresRebuild: true });
    expect(index.problems()).toEqual([]);
  });

  test("ignores a recheck of a file that is not an indexed entry", async () => {
    const index = await indexOf();

    expect(index.recheckReferences(fromContent("collection/other-entry.mdx"), "![Missing](./missing.png)\n")).toEqual({
      requiresRebuild: false,
    });
    expect(index.problems()).toEqual([]);
  });

  test("maps each entry's media directory path to the entry's absolute path", async () => {
    const { entryAbsolutePathsByMediaDirectoryPath } = await indexOf();
    expect(entryAbsolutePathsByMediaDirectoryPath).toEqual(new Map([[ENTRY.mediaDirectoryPath, ENTRY_ABSOLUTE_PATH]]));
  });

  test("lists the authored media problems before each entry's problems", async () => {
    const index = await indexOf({
      problems: ["An authored media problem."],
      images: { [BODY_IMAGE_FILE_PATH]: { problem: "An unreadable image." } },
    });
    expect(index.problems().slice(0, 2)).toEqual(["An authored media problem.", "An unreadable image."]);
  });

  test("lists cover images, renditions, and problems in entry order when the first entry's cover image is read last", async () => {
    // Both cover images are below the minimum size on their shortest side, so each entry produces a problem.
    const firstEntry = authoredEntryMedia({ bodyImageFileNames: [], videos: [] });
    const secondEntry = authoredEntryMedia({
      ...listedEntry("collection", "second-entry"),
      coverImageFilePath: "collection/second-entry.cover.png",
      bodyImageFileNames: [],
      videos: [],
    });
    const reader: MediaFileReader = {
      readImage: async (path) => {
        if (path === firstEntry.coverImageFilePath) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        return resolvedImage({ path, dimensions: { width: 100, height: 100 } });
      },
      readVideo: () => Promise.reject(new Error("Neither entry has a video.")),
    };

    const index = await indexOf({ entryMedia: [firstEntry, secondEntry], source: "", reader });
    const coverImageStems = [...index.renditionsByUrl.keys()].map((url) => url.split(".cover.")[0]);

    expect(Object.keys(index.coverImages)).toEqual([firstEntry.key, secondEntry.key]);
    expect(coverImageStems).toEqual([
      ...Array<string>(3).fill(mediaRoute("collection/entry")),
      ...Array<string>(3).fill(mediaRoute("collection/second-entry")),
    ]);
    expect(index.problems()).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" is smaller than`),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/second-entry.cover.png" is smaller than`),
    ]);
  });
});
