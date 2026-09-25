import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { CONTENT_SIGNAL } from "#/config/site.ts";
import { isEntryFile } from "#/lib/content/entry-file.ts";
import { mediaRoute } from "#/lib/content/paths.ts";

import { CLIENT_ENVIRONMENT } from "../../environments.ts";
import { IMMUTABLE_CACHE_CONTROL } from "../../headers.ts";
import { MEDIA_DIRECTORY_PATH, STYLESHEET_FILE_PATH, fromContent, fromRoot, requestPathOf } from "../../paths.ts";
import { layoutMetricsFrom } from "../../stylesheet/layout-metrics.ts";
import { RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID, entryCoverImagesPlugin } from "../entry-cover-images.ts";

import { createImageDerivativeStore, imageDerivativeAuditBetween } from "./derivative-store.ts";
import { isContentMedia } from "./formats.ts";
import { buildMediaIndex, coverImageSizeIn } from "./media-index.ts";
import { contentMediaProblemReport, renditionSizeProblems } from "./problems.ts";
import { rootRelativePathOf } from "./renditions.ts";
import { createMediaFileReader } from "./resolved-media.ts";

import type { MediaIndex } from "./media-index.ts";
import type { AddHeadersRules, HeadersRule } from "../../headers.ts";
import type { MediaForEntry } from "../markup/media-rewrite.ts";
import type { Logger, Plugin } from "vite";

const MEDIA_PATH_PREFIX = mediaRoute("");

const MEDIA_HEADERS_RULE: HeadersRule = {
  description: "Media URLs include content hashes and encoding-setting fingerprints.",
  pathPatterns: [mediaRoute("*")],
  headers: {
    "Cache-Control": IMMUTABLE_CACHE_CONTROL,
    "Content-Signal": CONTENT_SIGNAL,
  },
};

interface IndexChange {
  index: MediaIndex;
  hasChangedCoverImages: boolean;
}

// Warns once per active development problem. Index rebuilds replace tracked problems; problems detected
// outside the index remain tracked for the server's lifetime.
function createProblemReporter(warn: (problem: string) => void) {
  const reportedProblems = new Set<string>();

  let indexProblems: Array<string> = [];

  function reportNewProblems(problems: Array<string>) {
    for (const problem of problems.filter((candidate) => !reportedProblems.has(candidate))) {
      warn(problem);
      reportedProblems.add(problem);
    }
  }

  function replaceIndexProblems(problems: Array<string>) {
    indexProblems
      .filter((problem) => !problems.includes(problem))
      .forEach((problem) => reportedProblems.delete(problem));
    indexProblems = problems;
    reportNewProblems(problems);
  }

  return { reportNewProblems, replaceIndexProblems };
}

/**
 * Creates the media plugins and the resolver used by MDX and Markdown.
 *
 * A build reads only the committed derivatives. The dev server encodes a missing derivative on demand.
 */
export function contentMedia({ addHeadersRules }: { addHeadersRules: AddHeadersRules }): {
  plugins: Array<Plugin>;
  mediaForEntry: MediaForEntry;
} {
  const derivativeStore = createImageDerivativeStore(fromRoot(MEDIA_DIRECTORY_PATH));
  const contentDirectoryAbsolutePath = fromContent();
  const stylesheetAbsolutePath = fromRoot(STYLESHEET_FILE_PATH);
  // Shared by every index build, so a rebuild rereads only the files updated since the last one.
  const mediaFileReader = createMediaFileReader();

  let indexBuild: Promise<MediaIndex> | null = null;
  let latestIndexChange: { trigger: string; indexChange: Promise<IndexChange | null> } | null = null;
  let logger: Logger | undefined; // Set by `configResolved`, which Vite calls before any hook that reports a problem.

  const problemReporter = createProblemReporter((problem) => logger?.warn(problem, { timestamp: true }));

  // Every caller awaits the same build until a file update clears it, so an entry compiled after
  // the update resolves against an index that includes it.
  const ensureIndex = () => {
    if (indexBuild) {
      return indexBuild;
    }

    const currentIndexBuild: Promise<MediaIndex> = buildMediaIndex(mediaFileReader).catch((cause: unknown) => {
      // Clearing only this failed build lets later requests retry without discarding a
      // rebuild that a newer file update has already started.
      if (indexBuild === currentIndexBuild) {
        indexBuild = null;
      }

      throw cause;
    });

    return (indexBuild = currentIndexBuild);
  };

  async function rebuildIndex(): Promise<IndexChange> {
    const previousIndexBuild = indexBuild;

    indexBuild = null;

    const index = await ensureIndex();
    const previousIndex = await previousIndexBuild?.catch(() => null);

    return { index, hasChangedCoverImages: !isDeepStrictEqual(previousIndex?.coverImages, index.coverImages) };
  }

  async function changeIndexForStylesheet(readStylesheet: () => string | Promise<string>) {
    const coverImageSize = coverImageSizeIn(layoutMetricsFrom(await readStylesheet()));
    return coverImageSize === (await ensureIndex()).coverImageSize ? null : rebuildIndex();
  }

  // Resolves to the current index when the update does not change which body images have alternates,
  // so the rechecked reference problems are still reported.
  async function changeIndexForEntry(absolutePath: string, readSource: () => string | Promise<string>) {
    const source = await readSource();
    const index = await ensureIndex();
    const { requiresRebuild } = index.recheckReferences(absolutePath, source);

    return requiresRebuild ? rebuildIndex() : { index, hasChangedCoverImages: false };
  }

  // Resolves to `null` when the update leaves the index unchanged.
  function changeIndexFor(
    file: string,
    type: "create" | "update" | "delete",
    read: () => string | Promise<string>,
  ): Promise<IndexChange | null> {
    if (file === stylesheetAbsolutePath) {
      return changeIndexForStylesheet(read);
    }

    return isEntryFile(file) && type === "update" ? changeIndexForEntry(file, read) : rebuildIndex();
  }

  const mediaForEntry: MediaForEntry = async (absolutePath) => (await ensureIndex()).mediaForEntry(absolutePath);

  const mediaPlugin: Plugin = {
    name: "kuzmano.ski:content-media",
    enforce: "pre",
    configResolved(config) {
      logger = config.logger;
    },
    buildStart() {
      if (this.environment.name === CLIENT_ENVIRONMENT) {
        addHeadersRules([MEDIA_HEADERS_RULE]); // Registers the rule for `vite dev` as well, where the dev server serves `/media/*`.
      }
    },
    configureServer(server) {
      ensureIndex()
        .then((index) => problemReporter.replaceIndexProblems(index.problems()))
        .catch((cause: unknown) => logger?.error(`Content media could not be indexed: ${String(cause)}`));

      // Rewrite media requests so Vite's static middleware can stream them with range support.
      server.middlewares.use((request, response, next) => {
        const requestPath = requestPathOf(request);

        if (!requestPath?.startsWith(MEDIA_PATH_PREFIX)) {
          next();
          return;
        }

        let decodedRequestPath: string;

        try {
          decodedRequestPath = decodeURIComponent(requestPath);
        } catch {
          next(); // Malformed escapes result in a 404.
          return;
        }

        // A request arriving before the first index build finishes waits for it
        // rather than falling through to a 404.
        ensureIndex()
          .then(async ({ renditionsByUrl }) => {
            const rendition = renditionsByUrl.get(decodedRequestPath);

            if (!rendition) {
              next();
              return;
            }

            if (rendition.origin === "derivative") {
              const encodedByteLength = await derivativeStore.encodeIfMissing(rendition);

              if (encodedByteLength !== null) {
                problemReporter.reportNewProblems(renditionSizeProblems(rendition, encodedByteLength));
              }
            }

            response.setHeader("content-type", rendition.type); // Preserve the media type chosen by `formats.ts`; sirv respects this header.
            request.url = `/${rootRelativePathOf(rendition)}`;
            next();
          })
          .catch(next);
      });
    },
    async hotUpdate({ file, type, timestamp, modules, read }) {
      const isStylesheet = file === stylesheetAbsolutePath;

      if (!isStylesheet && !file.startsWith(`${contentDirectoryAbsolutePath}/`)) {
        return;
      }

      if (!isStylesheet && !isContentMedia(file) && !isEntryFile(file)) {
        return;
      }

      // Vite calls `hotUpdate` once per environment for the same file update, so whichever environment it calls first
      // starts the index change, and the others await it, including its comparison with the index before the update.
      const trigger = `${timestamp}:${type}:${file}`;

      if (latestIndexChange?.trigger !== trigger) {
        latestIndexChange = { trigger, indexChange: changeIndexFor(file, type, read) };
      }

      const indexChange = await latestIndexChange.indexChange;

      if (!indexChange) {
        return;
      }

      const { index, hasChangedCoverImages } = indexChange;

      if (this.environment.name === CLIENT_ENVIRONMENT) {
        problemReporter.replaceIndexProblems(index.problems());
      }

      // A reference names a file in its own entry's media directory, so an update to a body media file changes
      // only that entry's compiled output. The cover image module is invalidated only when its value changed,
      // so an update to one entry's body media invalidates that entry alone.
      const staleEntryAbsolutePath = index.entryAbsolutePathsByMediaDirectoryPath.get(
        relative(contentDirectoryAbsolutePath, dirname(file)),
      );
      const staleModules = [
        ...(hasChangedCoverImages ? [RESOLVED_ENTRY_COVER_IMAGES_MODULE_ID] : []),
        ...(staleEntryAbsolutePath === undefined ? [] : [staleEntryAbsolutePath]),
      ]
        .map((id) => this.environment.moduleGraph.getModuleById(id))
        .filter((module) => module !== undefined);

      staleModules.forEach((module) => this.environment.moduleGraph.invalidateModule(module));

      return [...modules, ...staleModules];
    },
  };

  // Validate and emit once for client builds; development only warns about media problems.
  const mediaEmitPlugin: Plugin = {
    name: "kuzmano.ski:content-media-emit",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
    async buildStart() {
      const index = await ensureIndex();
      const { missingDerivativeRenditions, staleDerivativeFileNames, sizeProblems } = imageDerivativeAuditBetween(
        index.renditionsByUrl.values(),
        await derivativeStore.storedByteLengths(),
      );
      const problems = [
        ...index.problems(),
        ...missingDerivativeRenditions.map((rendition) => `${rootRelativePathOf(rendition)} has not been generated.`),
        ...staleDerivativeFileNames.map((fileName) => `${join(MEDIA_DIRECTORY_PATH, fileName)} is no longer required.`),
        ...sizeProblems,
      ];

      if (problems.length > 0) {
        this.error(
          contentMediaProblemReport(problems) +
            (missingDerivativeRenditions.length > 0 || staleDerivativeFileNames.length > 0
              ? `\nRun \`npm run prepare-media\` to bring \`${MEDIA_DIRECTORY_PATH}\` up to date.`
              : ""),
        );
      }
    },
    // Copies each file into the output rather than emitting it into the bundle, which would hold every
    // image and video in memory until the bundle is written. `buildStart` has already failed the build
    // on a missing derivative, so every file is present.
    async writeBundle() {
      const { root, build } = this.environment.config;
      const outputDirectoryAbsolutePath = resolve(root, build.outDir);
      const { renditionsByUrl } = await ensureIndex();

      await Promise.all(
        [...renditionsByUrl].map(async ([url, rendition]) => {
          const destinationAbsolutePath = join(outputDirectoryAbsolutePath, url);

          await mkdir(dirname(destinationAbsolutePath), { recursive: true });
          await copyFile(fromRoot(rootRelativePathOf(rendition)), destinationAbsolutePath);
        }),
      );
    },
  };

  const coverImagesPlugin = entryCoverImagesPlugin(async () => (await ensureIndex()).coverImages);

  return { plugins: [mediaPlugin, coverImagesPlugin, mediaEmitPlugin], mediaForEntry };
}
