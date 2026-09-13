import { describe, expect, test, vi } from "vitest";

import type { EntryKey } from "#/lib/content/entry-file.ts";
import type { CoverImage } from "#/lib/content/media.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { CLIENT_ENVIRONMENT, SERVER_ENVIRONMENT } from "../../environments.ts";
import { STYLESHEET_FILE_PATH, fromContent, fromRoot } from "../../paths.ts";
import { RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID } from "../entry-cover-images.ts";

import { contentMedia } from "./plugin.ts";

import type * as mediaIndexModule from "./media-index.ts";
import type { MediaIndex } from "./media-index.ts";
import type { Plugin } from "vite";

const { indexBuilds, buildMediaIndex } = vi.hoisted(() => {
  const startedIndexBuilds: Array<{ resolve: (index: unknown) => void; reject: (cause: unknown) => void }> = [];
  return {
    indexBuilds: startedIndexBuilds,
    buildMediaIndex: () => new Promise((resolve, reject) => startedIndexBuilds.push({ resolve, reject })),
  };
});

vi.mock("./media-index.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof mediaIndexModule>()),
  buildMediaIndex,
}));

const CONTENT_DIRECTORY_ABSOLUTE_PATH = fromContent();
const ENTRY_ABSOLUTE_PATH = `${CONTENT_DIRECTORY_ABSOLUTE_PATH}/collection/entry.mdx`;
const IMAGE_ABSOLUTE_PATH = `${CONTENT_DIRECTORY_ABSOLUTE_PATH}/collection/entry/image.png`;
const COVER_IMAGE_ABSOLUTE_PATH = `${CONTENT_DIRECTORY_ABSOLUTE_PATH}/collection/entry.cover.png`;
const ENTRY_STYLESHEET_ABSOLUTE_PATH = `${CONTENT_DIRECTORY_ABSOLUTE_PATH}/collection/entry.module.css`;
const SECOND_ENTRY_ABSOLUTE_PATH = `${CONTENT_DIRECTORY_ABSOLUTE_PATH}/collection/second-entry.mdx`;
const STYLESHEET_ABSOLUTE_PATH = fromRoot(STYLESHEET_FILE_PATH);

const COVER_IMAGE_SIZE = 64;
const COVER_IMAGE: CoverImage = {
  social: { src: mediaRoute("collection/entry.cover.png"), width: 512, height: 512 },
  thumbnail: { kind: "image", src: mediaRoute("collection/entry.cover.webp"), width: 128, height: 128, alternates: [] },
};

type FileChangeType = "create" | "update" | "delete";

interface FileChange {
  file: string;
  type?: FileChangeType;
  source?: string;
  timestamp?: number;
  environmentName?: string;
}

interface Logger {
  warn: (message: string) => void;
  error: (message: string) => void;
}

interface DevServer {
  middlewares: { use: () => void };
}

type HotUpdate = (
  this: unknown,
  options: {
    file: string;
    type: FileChangeType;
    timestamp: number;
    modules: Array<{ id: string }>;
    read: () => string;
  },
) => Promise<Array<{ id: string }> | undefined>;

const mediaIndex = (overrides: Partial<MediaIndex> = {}): MediaIndex => ({
  coverImageSize: COVER_IMAGE_SIZE,
  coverImages: {},
  renditionsByUrl: new Map(),
  entryAbsolutePathsByMediaDirectoryPath: new Map([
    ["collection/entry", ENTRY_ABSOLUTE_PATH],
    ["collection/second-entry", SECOND_ENTRY_ABSOLUTE_PATH],
  ]),
  mediaForEntry: () => () => null,
  recheckReferences: () => true,
  problems: () => [],
  ...overrides,
});

const stylesheetDeclaringCoverImageSize = (pixels: number) => `:root {
  --layout-cover-image-size: ${pixels}px;
}
`;
const mediaIndexWithCoverImage = () => mediaIndex({ coverImages: { ["collection/entry" as EntryKey]: COVER_IMAGE } });
const mediaIndexResolvingTo = (src: string) =>
  mediaIndex({ mediaForEntry: () => () => ({ kind: "image", src, width: 1, height: 1, alternates: [] }) });
const environmentContext = (name: string) => ({
  environment: { name, moduleGraph: { getModuleById: (id: string) => ({ id }), invalidateModule: () => undefined } },
});

let latestTimestamp = 0;

const nextTimestamp = () => (latestTimestamp += 1);

function setUpContentMedia() {
  indexBuilds.length = 0;

  const warn = vi.fn<(message: string) => void>();
  const logger: Logger = { warn, error: vi.fn() };
  const devServer: DevServer = { middlewares: { use: () => undefined } };
  const { plugins, mediaForEntry } = contentMedia();
  const mediaPlugin: Plugin = plugins.find((plugin) => plugin.name === "kuzmano.ski:content-media")!;

  (mediaPlugin.configResolved as unknown as (config: { logger: Logger }) => void)({ logger });

  const startDevServer = () => (mediaPlugin.configureServer as unknown as (server: DevServer) => void)(devServer);
  const updateFile = ({
    file,
    type = "update",
    source = "",
    timestamp = nextTimestamp(),
    environmentName = CLIENT_ENVIRONMENT,
  }: FileChange) =>
    (mediaPlugin.hotUpdate as unknown as HotUpdate).call(environmentContext(environmentName), {
      file,
      type,
      timestamp,
      modules: [],
      read: () => source,
    });
  const mediaSourceFor = async (reference: string) => (await mediaForEntry(ENTRY_ABSOLUTE_PATH))(reference)?.src;

  // Finishes the first index build, which the resolver starts, before a test updates any file.
  const buildInitialIndex = async (index = mediaIndex()) => {
    const initialResolution = mediaForEntry(ENTRY_ABSOLUTE_PATH);

    indexBuilds[0]!.resolve(index);
    await initialResolution;
  };

  const warnedProblems = () => warn.mock.calls.map(([problem]) => problem);
  const staleModuleIdsAfterRebuild = async (fileUpdate: ReturnType<typeof updateFile>, rebuiltIndex: MediaIndex) => {
    await vi.waitFor(() => expect(indexBuilds).toHaveLength(2));
    indexBuilds[1]!.resolve(rebuiltIndex);

    return ((await fileUpdate) ?? []).map(({ id }) => id);
  };

  return {
    startDevServer,
    updateFile,
    mediaSourceFor,
    buildInitialIndex,
    warnedProblems,
    staleModuleIdsAfterRebuild,
  };
}

describe("contentMedia", () => {
  test("resolves a reference through the newest index build when an earlier build finishes after it", async () => {
    const { updateFile, mediaSourceFor } = setUpContentMedia();
    const firstFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });
    const secondFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

    expect(indexBuilds).toHaveLength(2);

    indexBuilds[1]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.new.png")));
    indexBuilds[0]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.old.png")));
    await Promise.all([firstFileUpdate, secondFileUpdate]);

    await expect(mediaSourceFor("./image.png")).resolves.toBe(mediaRoute("collection/entry/image.new.png"));
  });

  test("resolves a reference through the newest index build when it finishes after an earlier build", async () => {
    const { updateFile, mediaSourceFor } = setUpContentMedia();
    const firstFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });
    const secondFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

    indexBuilds[0]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.old.png")));
    indexBuilds[1]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.new.png")));
    await Promise.all([firstFileUpdate, secondFileUpdate]);

    await expect(mediaSourceFor("./image.png")).resolves.toBe(mediaRoute("collection/entry/image.new.png"));
  });

  test("starts a new index build for a file update after the previous build fails", async () => {
    const { updateFile, mediaSourceFor } = setUpContentMedia();
    const failedFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

    indexBuilds[0]!.reject(new Error("An image could not be read."));

    await expect(failedFileUpdate).rejects.toThrow("An image could not be read.");

    const retriedFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

    expect(indexBuilds).toHaveLength(2);

    indexBuilds[1]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.png")));
    await retriedFileUpdate;

    await expect(mediaSourceFor("./image.png")).resolves.toBe(mediaRoute("collection/entry/image.png"));
  });

  test("resolves a reference requested during a rebuild through the rebuilt index", async () => {
    const { updateFile, mediaSourceFor, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex(mediaIndexResolvingTo(mediaRoute("collection/entry/image.old.png")));

    const fileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });
    const sourceDuringRebuild = mediaSourceFor("./image.png");

    indexBuilds[1]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.new.png")));
    await fileUpdate;

    await expect(sourceDuringRebuild).resolves.toBe(mediaRoute("collection/entry/image.new.png"));
  });

  test("warns about the problems of the first index build when the dev server starts", async () => {
    const { startDevServer, warnedProblems } = setUpContentMedia();

    startDevServer();
    indexBuilds[0]!.resolve(mediaIndex({ problems: () => ["A problem."] }));

    await vi.waitFor(() => expect(warnedProblems()).toEqual(["A problem."]));
  });

  test("rebuilds the index when a media file is updated", async () => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex();

    const fileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

    expect(indexBuilds).toHaveLength(2);

    indexBuilds[1]!.resolve(mediaIndex());
    await fileUpdate;
  });

  test.each([
    ["created", "create"],
    ["deleted", "delete"],
  ] as const)("rebuilds the index when an entry file is %s", async (_, type) => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex();

    const fileUpdate = updateFile({ file: ENTRY_ABSOLUTE_PATH, type });

    expect(indexBuilds).toHaveLength(2);

    indexBuilds[1]!.resolve(mediaIndex());
    await fileUpdate;
  });

  test("does not rebuild the index when an entry stylesheet is updated", async () => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex();
    await updateFile({ file: ENTRY_STYLESHEET_ABSOLUTE_PATH });

    expect(indexBuilds).toHaveLength(1);
  });

  test("rebuilds the index only once when each environment reports the same file update", async () => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex();

    const timestamp = nextTimestamp();
    const clientFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH, timestamp });
    const serverFileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH, timestamp, environmentName: SERVER_ENVIRONMENT });

    expect(indexBuilds).toHaveLength(2);

    indexBuilds[1]!.resolve(mediaIndex());
    await Promise.all([clientFileUpdate, serverFileUpdate]);
  });

  test("rebuilds the index when an update to the site stylesheet changes the cover image size", async () => {
    const { updateFile, buildInitialIndex, staleModuleIdsAfterRebuild } = setUpContentMedia();
    const changedCoverImageSize = COVER_IMAGE_SIZE + 8;

    await buildInitialIndex();

    const fileUpdate = updateFile({
      file: STYLESHEET_ABSOLUTE_PATH,
      source: stylesheetDeclaringCoverImageSize(changedCoverImageSize),
    });

    await staleModuleIdsAfterRebuild(fileUpdate, mediaIndex({ coverImageSize: changedCoverImageSize }));

    expect(indexBuilds).toHaveLength(2);
  });

  test("does not rebuild the index when an update to the site stylesheet does not change the cover image size", async () => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex();
    await updateFile({
      file: STYLESHEET_ABSOLUTE_PATH,
      source: stylesheetDeclaringCoverImageSize(COVER_IMAGE_SIZE),
    });

    expect(indexBuilds).toHaveLength(1);
  });

  test("invalidates only the entry whose media directory contains an updated media file", async () => {
    const { updateFile, buildInitialIndex, staleModuleIdsAfterRebuild } = setUpContentMedia();

    await buildInitialIndex();

    const staleModuleIds = await staleModuleIdsAfterRebuild(updateFile({ file: IMAGE_ABSOLUTE_PATH }), mediaIndex());

    expect(staleModuleIds).toEqual([ENTRY_ABSOLUTE_PATH]);
  });

  test("invalidates the cover image module when a file update changes the cover images", async () => {
    const { updateFile, buildInitialIndex, staleModuleIdsAfterRebuild } = setUpContentMedia();

    await buildInitialIndex();

    const fileUpdate = updateFile({ file: COVER_IMAGE_ABSOLUTE_PATH, type: "create" });
    const staleModuleIds = await staleModuleIdsAfterRebuild(fileUpdate, mediaIndexWithCoverImage());

    expect(staleModuleIds).toEqual([RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID]);
  });

  test("does not invalidate the cover image module when a file update does not change the cover images", async () => {
    const { updateFile, buildInitialIndex, staleModuleIdsAfterRebuild } = setUpContentMedia();

    await buildInitialIndex(mediaIndexWithCoverImage());

    const fileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });
    const staleModuleIds = await staleModuleIdsAfterRebuild(fileUpdate, mediaIndexWithCoverImage());

    expect(staleModuleIds).toEqual([ENTRY_ABSOLUTE_PATH]);
  });

  test("invalidates the cover image module in each environment that reports a file update that changes the cover images", async () => {
    const { updateFile, buildInitialIndex, staleModuleIdsAfterRebuild } = setUpContentMedia();

    await buildInitialIndex();

    // Vite calls the server environment's hook after the client environment's hook has
    // returned, by which time the index has already been rebuilt.
    const timestamp = nextTimestamp();
    const clientFileUpdate = updateFile({ file: COVER_IMAGE_ABSOLUTE_PATH, timestamp });
    const clientStaleModuleIds = await staleModuleIdsAfterRebuild(clientFileUpdate, mediaIndexWithCoverImage());
    const serverStaleModules = await updateFile({
      file: COVER_IMAGE_ABSOLUTE_PATH,
      timestamp,
      environmentName: SERVER_ENVIRONMENT,
    });

    expect(clientStaleModuleIds).toEqual([RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID]);
    expect(serverStaleModules?.map(({ id }) => id)).toEqual([RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID]);
  });

  test("rechecks an updated entry's references only in the client environment", async () => {
    const { updateFile, buildInitialIndex } = setUpContentMedia();
    const recheckReferences = vi.fn<MediaIndex["recheckReferences"]>();

    await buildInitialIndex(mediaIndex({ recheckReferences }));
    await updateFile({ file: ENTRY_ABSOLUTE_PATH, environmentName: SERVER_ENVIRONMENT });

    expect(recheckReferences).not.toHaveBeenCalled();
  });

  test("rechecks an updated entry's references, and does not rebuild the index, when an entry update does not change which images have alternates", async () => {
    const { updateFile, buildInitialIndex, warnedProblems } = setUpContentMedia();
    const recheckReferences = vi.fn<MediaIndex["recheckReferences"]>(() => true);
    const source = "![An image](./missing.png)\n";

    await buildInitialIndex(
      mediaIndex({
        recheckReferences,
        problems: () => (recheckReferences.mock.calls.length > 0 ? ["A reference problem."] : []),
      }),
    );
    await updateFile({ file: ENTRY_ABSOLUTE_PATH, source });

    expect(indexBuilds).toHaveLength(1);
    expect(recheckReferences).toHaveBeenCalledWith(ENTRY_ABSOLUTE_PATH, source);
    expect(warnedProblems()).toEqual(["A reference problem."]);
  });

  test("rebuilds the index, and resolves references through the rebuilt index, when an entry update changes which images have alternates", async () => {
    const { updateFile, mediaSourceFor, buildInitialIndex } = setUpContentMedia();

    await buildInitialIndex(mediaIndex({ recheckReferences: () => false }));

    const fileUpdate = updateFile({ file: ENTRY_ABSOLUTE_PATH });

    await vi.waitFor(() => expect(indexBuilds).toHaveLength(2));
    indexBuilds[1]!.resolve(mediaIndexResolvingTo(mediaRoute("collection/entry/image.png")));
    await fileUpdate;

    await expect(mediaSourceFor("./image.png")).resolves.toBe(mediaRoute("collection/entry/image.png"));
  });

  test("warns about a problem once, after the first rebuild that produces it", async () => {
    const { updateFile, buildInitialIndex, warnedProblems } = setUpContentMedia();

    await buildInitialIndex();

    for (const problems of [["A problem."], ["A problem."], ["A problem.", "Another problem."]]) {
      const fileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

      indexBuilds.at(-1)!.resolve(mediaIndex({ problems: () => problems }));
      await fileUpdate;
    }

    expect(warnedProblems()).toEqual(["A problem.", "Another problem."]);
  });

  test("warns again about a problem that a file update fixed and a later file update reintroduced", async () => {
    const { updateFile, buildInitialIndex, warnedProblems } = setUpContentMedia();

    await buildInitialIndex();

    for (const problems of [["A problem."], [], ["A problem."]]) {
      const fileUpdate = updateFile({ file: IMAGE_ABSOLUTE_PATH });

      indexBuilds.at(-1)!.resolve(mediaIndex({ problems: () => problems }));
      await fileUpdate;
    }

    expect(warnedProblems()).toEqual(["A problem.", "A problem."]);
  });
});
