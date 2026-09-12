import { describe, expect, test } from "vitest";

import { CONTENT_DIRECTORY_PATH, fromContent } from "../../paths.ts";
import { ENTRY_SOURCE, VIDEO_FILE_NAME, authoredEntryMedia } from "../../test-utils/media.ts";

import { authoredMediaIn, mediaReferenceProblems } from "./authored-media.ts";

import type { ContentDirectoryListing } from "../listing.ts";

const directoryListing = (overrides: Partial<ContentDirectoryListing> = {}): ContentDirectoryListing => ({
  directoryName: "collection",
  fileNames: ["entry.mdx"],
  fileNamesBySubdirectoryName: {},
  ...overrides,
});
const mediaIn = (overrides?: Partial<ContentDirectoryListing>) =>
  authoredMediaIn(directoryListing(overrides)).entryMedia;
const problemsIn = (overrides?: Partial<ContentDirectoryListing>) =>
  authoredMediaIn(directoryListing(overrides)).problems;

describe("authoredMediaIn", () => {
  test("returns the media of every entry file in the directory", () => {
    expect(mediaIn({ fileNames: ["entry.mdx", "other-entry.mdx"] })).toEqual([
      {
        slug: "entry",
        key: "collection/entry",
        entryFilePath: "collection/entry.mdx",
        absolutePath: fromContent("collection/entry.mdx"),
        mediaDirectoryPath: "collection/entry",
        coverImageFilePath: null,
        bodyImageFileNames: [],
        videos: [],
      },
      {
        slug: "other-entry",
        key: "collection/other-entry",
        entryFilePath: "collection/other-entry.mdx",
        absolutePath: fromContent("collection/other-entry.mdx"),
        mediaDirectoryPath: "collection/other-entry",
        coverImageFilePath: null,
        bodyImageFileNames: [],
        videos: [],
      },
    ]);
  });

  test("assigns a sibling cover image to its entry", () => {
    const { entryMedia, problems } = authoredMediaIn(directoryListing({ fileNames: ["entry.mdx", "entry.cover.png"] }));

    expect(entryMedia[0]?.coverImageFilePath).toBe("collection/entry.cover.png");
    expect(problems).toEqual([]);
  });

  test("does not assign a sibling file without the `.cover` stem suffix as the cover image", () => {
    expect(mediaIn({ fileNames: ["entry.mdx", "entry.module.css"] })[0]?.coverImageFilePath).toBeNull();
  });

  test("reports multiple cover images for an entry, and does not assign either", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNames: ["entry.mdx", "entry.cover.png", "entry.cover.jpg"] }),
    );

    expect(entryMedia[0]?.coverImageFilePath).toBeNull();
    expect(problems).toEqual([expect.stringMatching(/contains multiple cover images for entry.*entry\.cover\.png/s)]);
  });

  test("reports a cover image with a URL-unsafe name", () => {
    expect(problemsIn({ fileNames: ["entry.mdx", "entry.cover.PNG"] })).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.PNG" has a URL-unsafe file name`),
    ]);
  });

  test("reports a cover image in a format the build does not encode, and does not assign it", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNames: ["entry.mdx", "entry.cover.webp"] }),
    );

    expect(entryMedia[0]?.coverImageFilePath).toBeNull();
    expect(problems).toEqual([
      expect.stringContaining(
        `The image format of "${CONTENT_DIRECTORY_PATH}/collection/entry.cover.webp" is not supported for cover images`,
      ),
    ]);
  });

  test("reports a cover image that is a video, and does not assign it", () => {
    const { entryMedia, problems } = authoredMediaIn(directoryListing({ fileNames: ["entry.mdx", "entry.cover.mp4"] }));

    expect(entryMedia[0]?.coverImageFilePath).toBeNull();
    expect(problems).toEqual([
      expect.stringContaining(
        `The image format of "${CONTENT_DIRECTORY_PATH}/collection/entry.cover.mp4" is not supported for cover images`,
      ),
    ]);
  });

  test("reports a cover image without a corresponding entry", () => {
    expect(problemsIn({ fileNames: ["entry.mdx", "other-entry.cover.png"] })).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/other-entry.cover.png" is a cover image without a corresponding entry.`,
    ]);
  });

  test("reports a cover image in a directory without entry files", () => {
    const { entryMedia, problems } = authoredMediaIn(directoryListing({ fileNames: ["entry.cover.png"] }));

    expect(entryMedia).toEqual([]);
    expect(problems).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.png" is a cover image without a corresponding entry.`,
    ]);
  });

  test.each(["other-entry.cover.webp", "other-entry.cover.mp4", "Other-Entry.cover.png"])(
    "reports %s only as a cover image without a corresponding entry",
    (coverImage) => {
      expect(problemsIn({ fileNames: ["entry.mdx", coverImage] })).toEqual([
        `"${CONTENT_DIRECTORY_PATH}/collection/${coverImage}" is a cover image without a corresponding entry.`,
      ]);
    },
  );

  test("reports a cover image whose name only begins with an entry's cover image name as one without a corresponding entry", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNames: ["entry.mdx", "entry.cover.png", "entry.cover.old.png"] }),
    );

    expect(entryMedia[0]?.coverImageFilePath).toBe("collection/entry.cover.png");
    expect(problems).toEqual([
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.cover.old.png" is a cover image without a corresponding entry.`,
    ]);
  });

  test("assigns a cover image to an entry whose slug ends with the cover stem suffix", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNames: ["entry.mdx", "entry.cover.mdx", "entry.cover.cover.png"] }),
    );

    expect(entryMedia.map(({ slug, coverImageFilePath }) => ({ slug, coverImageFilePath }))).toEqual([
      { slug: "entry", coverImageFilePath: null },
      { slug: "entry.cover", coverImageFilePath: "collection/entry.cover.cover.png" },
    ]);
    expect(problems).toEqual([]);
  });

  test("assigns images in the directory named after an entry as its body images", () => {
    expect(
      mediaIn({ fileNamesBySubdirectoryName: { entry: ["image.png", "file.txt"] } })[0]?.bodyImageFileNames,
    ).toEqual(["image.png"]);
  });

  test("accepts an image name of hyphen-separated letters and digits", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["image-name-1.png"] } })).toEqual([]);
  });

  test("reports a file in a media directory that is neither an image nor a video", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["file.txt"] } })).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/file.txt" is not a supported`),
    ]);
  });

  test("reports an image with a URL-unsafe name", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["Image Name.png"] } })).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/Image Name.png" has a URL-unsafe file name`),
    ]);
  });

  test("reports an image with an uppercase extension", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["image.PNG"] } })).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/image.PNG" has a URL-unsafe file name`),
    ]);
  });

  test("ignores a subdirectory that does not match any entry", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNamesBySubdirectoryName: { archive: ["image.png"] } }),
    );

    expect(entryMedia[0]?.bodyImageFileNames).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("pairs a video with the poster image named after it", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.png"] } }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: "video.poster.png" }]);
    expect(problems).toEqual([]);
  });

  test("pairs a video with a poster image that has an uppercase extension, and reports only its URL-unsafe name", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.PNG"] } }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: "video.poster.PNG" }]);
    expect(problems).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.poster.PNG" has a URL-unsafe file name`,
      ),
    ]);
  });

  test("omits a paired poster image from the body images", () => {
    expect(
      mediaIn({ fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.png"] } })[0]?.bodyImageFileNames,
    ).toEqual([]);
  });

  test("reports a video without a poster image, and records the video without one", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNamesBySubdirectoryName: { entry: ["video.mp4"] } }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: null }]);
    expect(problems).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" has no poster image`),
    ]);
  });

  test("reports a video with more than one poster image, and records the video without one", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({
        fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.png", "video.poster.jpg"] },
      }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: null }]);
    expect(problems).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" has more than one poster image`),
    ]);
  });

  test("reports a poster image in a format the build does not encode, and records the video without one", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({ fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.gif"] } }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: null }]);
    expect(problems).toEqual([
      expect.stringContaining(
        `The image format of "${CONTENT_DIRECTORY_PATH}/collection/entry/video.poster.gif" is not supported for poster images`,
      ),
    ]);
  });

  test("reports an image named as a poster image without a corresponding video", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["video.poster.png"] } })).toEqual([
      expect.stringContaining(
        `"${CONTENT_DIRECTORY_PATH}/collection/entry/video.poster.png" is named as a poster image`,
      ),
    ]);
  });

  test("omits an image named as a poster image without a corresponding video from the body images", () => {
    expect(mediaIn({ fileNamesBySubdirectoryName: { entry: ["video.poster.png"] } })[0]?.bodyImageFileNames).toEqual(
      [],
    );
  });

  test("does not pair an image whose name only begins with the poster image name, and assigns it as a body image", () => {
    const { entryMedia, problems } = authoredMediaIn(
      directoryListing({
        fileNamesBySubdirectoryName: { entry: ["video.mp4", "video.poster.png", "video.poster.old.png"] },
      }),
    );

    expect(entryMedia[0]?.videos).toEqual([{ videoFileName: "video.mp4", posterImageFileName: "video.poster.png" }]);
    expect(entryMedia[0]?.bodyImageFileNames).toEqual(["video.poster.old.png"]);
    expect(problems).toEqual([]);
  });

  test("reports a video and its poster image with URL-unsafe names", () => {
    expect(problemsIn({ fileNamesBySubdirectoryName: { entry: ["Video Name.mp4", "Video Name.poster.png"] } })).toEqual(
      [
        expect.stringContaining(
          `"${CONTENT_DIRECTORY_PATH}/collection/entry/Video Name.poster.png" has a URL-unsafe file name`,
        ),
        expect.stringContaining(
          `"${CONTENT_DIRECTORY_PATH}/collection/entry/Video Name.mp4" has a URL-unsafe file name`,
        ),
      ],
    );
  });
});

describe("mediaReferenceProblems", () => {
  const entry = authoredEntryMedia({ coverImageFilePath: null });

  test("accepts an entry that references each of its body media", () => {
    expect(mediaReferenceProblems(ENTRY_SOURCE, entry)).toEqual([]);
  });

  test("accepts a reference to a poster image", () => {
    expect(
      mediaReferenceProblems(`${ENTRY_SOURCE}\n<video src="./video.mp4" poster="./video.poster.png" />\n`, entry),
    ).toEqual([]);
  });

  test("accepts a poster image the entry does not reference", () => {
    expect(mediaReferenceProblems(ENTRY_SOURCE, entry).join(" ")).not.toContain("video.poster.png");
  });

  test("reports a reference to a missing file", () => {
    expect(mediaReferenceProblems(`${ENTRY_SOURCE}\n![Missing](./missing.png)\n`, entry)).toEqual([
      expect.stringContaining(
        `references "./missing.png", which is not a file in "${CONTENT_DIRECTORY_PATH}/collection/entry/"`,
      ),
    ]);
  });

  test("reports a reference into a subdirectory", () => {
    expect(mediaReferenceProblems(`${ENTRY_SOURCE}\n![Nested](./nested/image.png)\n`, entry)).toEqual([
      expect.stringMatching(/references "\.\/nested\/image\.png"/),
    ]);
  });

  test("reports a body image the entry does not reference", () => {
    expect(mediaReferenceProblems('<video src="./video.mp4" />\n', entry)).toEqual([
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/image.png" is not referenced by`),
    ]);
  });

  test("reports a Markdown image whose source references a video", () => {
    expect(mediaReferenceProblems(`${ENTRY_SOURCE}\n![A video](./video.mp4)\n`, entry)).toEqual([
      expect.stringMatching(/references "\.\/video\.mp4", which is a video, where only an image can be rendered/),
    ]);
  });

  test("reports a `<video>` whose source references an image", () => {
    const withImageSource = '![An image](./image.png)\n\n<video src="./image.png" />\n';
    expect(mediaReferenceProblems(withImageSource, entry)).toEqual([
      expect.stringMatching(/references "\.\/image\.png", which is an image, where only a video can be rendered/),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" is not referenced by`),
    ]);
  });

  test("reports a `<video>` whose `<source>` references an image", () => {
    const withImageSourceChild = '![An image](./image.png)\n\n<video><source src="./image.png" /></video>\n';

    expect(mediaReferenceProblems(withImageSourceChild, entry)).toEqual([
      expect.stringMatching(/references "\.\/image\.png", which is an image, where only a video can be rendered/),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/video.mp4" is not referenced by`),
    ]);
  });

  test("parses a title containing MDX syntax as frontmatter rather than as the entry's body", () => {
    const withMdxSyntaxInTitle = `---\ntitle: "Taps: <NSEvent> and { a brace }"\n---\n\n${ENTRY_SOURCE}`;
    expect(mediaReferenceProblems(withMdxSyntaxInTitle, entry)).toEqual([]);
  });

  test("ignores a Markdown image written in the frontmatter", () => {
    const withImageInDescription = `---\ndescription: "![An image](./missing.png)"\n---\n\n${ENTRY_SOURCE}`;
    expect(mediaReferenceProblems(withImageInDescription, entry)).toEqual([]);
  });

  test("accepts a reference to a video without a paired poster image", () => {
    const withoutPosterImage = authoredEntryMedia({
      coverImageFilePath: null,
      videos: [{ videoFileName: VIDEO_FILE_NAME, posterImageFileName: null }],
    });
    expect(mediaReferenceProblems(ENTRY_SOURCE, withoutPosterImage)).toEqual([]);
  });

  test("lists unreferenced files in name order after the reference problems", () => {
    const withTwoImages = authoredEntryMedia({
      coverImageFilePath: null,
      bodyImageFileNames: ["second.png", "first.png"],
    });
    expect(mediaReferenceProblems('<video src="./video.mp4" />\n![Missing](./missing.png)\n', withTwoImages)).toEqual([
      expect.stringMatching(/references "\.\/missing\.png"/),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/first.png" is not referenced`),
      expect.stringContaining(`"${CONTENT_DIRECTORY_PATH}/collection/entry/second.png" is not referenced`),
    ]);
  });

  test("resolves a reference written without a leading `./` to the same file", () => {
    expect(mediaReferenceProblems('![An image](image.png)\n\n<video src="video.mp4" />\n', entry)).toEqual([]);
  });
});
