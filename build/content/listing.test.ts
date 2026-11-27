import { describe, expect, test } from "vitest";

import { fromContent } from "../paths.ts";

import { contentListingFrom, listedEntriesIn } from "./listing.ts";

import type { DirectoryItem, DirectoryReader } from "./listing.ts";

const fileItem = (name: string): DirectoryItem => ({ name, type: "file" });
const directoryItem = (name: string): DirectoryItem => ({ name, type: "directory" });

// Tree keys are paths relative to the content directory, joined to match `contentListingFrom`.
const readerFor =
  (tree: Record<string, Array<DirectoryItem>>): DirectoryReader =>
  (directoryPathSegments) =>
    tree[directoryPathSegments.join("/")] ?? [];

describe("contentListingFrom", () => {
  test("lists each directory under the content root with its files", () => {
    const read = readerFor({
      "": [directoryItem("collection")],
      collection: [fileItem("entry.mdx"), fileItem("entry.cover.png")],
    });
    expect(contentListingFrom(read)).toEqual([
      { directoryName: "collection", fileNames: ["entry.cover.png", "entry.mdx"], fileNamesBySubdirectoryName: {} },
    ]);
  });

  test("sorts directory and file names", () => {
    const read = readerFor({
      "": [directoryItem("collection-2"), directoryItem("collection-1")],
      "collection-1": [fileItem("entry-2.mdx"), fileItem("entry-1.mdx"), directoryItem("entry-2")],
      "collection-1/entry-2": [fileItem("video.mp4"), fileItem("image.png")],
      "collection-2": [],
    });
    const [firstCollection, secondCollection] = contentListingFrom(read);

    expect([firstCollection?.directoryName, secondCollection?.directoryName]).toEqual(["collection-1", "collection-2"]);
    expect(firstCollection?.fileNames).toEqual(["entry-1.mdx", "entry-2.mdx"]);
    expect(firstCollection?.fileNamesBySubdirectoryName).toEqual({ "entry-2": ["image.png", "video.mp4"] });
  });

  test("lists a subdirectory with the files it contains", () => {
    const read = readerFor({
      "": [directoryItem("collection")],
      collection: [fileItem("entry.mdx"), directoryItem("entry")],
      "collection/entry": [fileItem("image.png")],
    });
    expect(contentListingFrom(read)[0]?.fileNamesBySubdirectoryName).toEqual({ entry: ["image.png"] });
  });

  test("omits a file at the content root", () => {
    const read = readerFor({ "": [fileItem("README.md"), directoryItem("collection")], collection: [] });
    expect(contentListingFrom(read).map(({ directoryName }) => directoryName)).toEqual(["collection"]);
  });

  test("omits a name beginning with a dot at every level", () => {
    const read = readerFor({
      "": [directoryItem(".hidden"), directoryItem("collection")],
      collection: [fileItem(".entry.mdx"), fileItem("entry.mdx"), directoryItem(".scratch"), directoryItem("entry")],
      "collection/entry": [fileItem(".DS_Store"), fileItem("image.png")],
    });
    expect(contentListingFrom(read)).toEqual([
      { directoryName: "collection", fileNames: ["entry.mdx"], fileNamesBySubdirectoryName: { entry: ["image.png"] } },
    ]);
  });
});

describe("listedEntriesIn", () => {
  test("lists an entry file with its slug, key, paths, and media directory, and omits other files", () => {
    const contentDirectory = {
      directoryName: "collection",
      fileNames: ["entry.mdx", "entry.cover.png", "entry.module.css"],
      fileNamesBySubdirectoryName: { entry: ["image.png"] },
    };
    expect(listedEntriesIn(contentDirectory)).toEqual([
      {
        slug: "entry",
        key: "collection/entry",
        entryFilePath: "collection/entry.mdx",
        absolutePath: fromContent("collection/entry.mdx"),
        mediaDirectoryPath: "collection/entry",
      },
    ]);
  });

  test("derives an entry's media directory whether or not the directory exists", () => {
    expect(
      listedEntriesIn({ directoryName: "collection", fileNames: ["entry.mdx"], fileNamesBySubdirectoryName: {} })[0]
        ?.mediaDirectoryPath,
    ).toBe("collection/entry");
  });
});
