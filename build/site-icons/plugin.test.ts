import { describe, expect, test, vi } from "vitest";

import { CLIENT_ENVIRONMENT } from "../environments.ts";
import { ICON_ARTWORK_FILE_PATH, STYLESHEET_FILE_PATH, fromRoot } from "../paths.ts";
import { devServerMiddlewareOf, devServerRequestFor } from "../test-utils/dev-server.ts";

import { siteIconsPlugin } from "./plugin.ts";

import type { IconFile } from "./icon-files.ts";
import type * as manifestModule from "./manifest.ts";

const { iconFilesFrom } = vi.hoisted(() => ({ iconFilesFrom: vi.fn<() => Promise<Array<IconFile>>>() }));

vi.mock("../stylesheet/palette.ts", () => ({ readPalette: () => Promise.resolve({}) }));
vi.mock("./artwork.ts", () => ({ readArtwork: () => Promise.resolve({}) }));
vi.mock("./icon-files.ts", () => ({ iconFilesFrom }));
vi.mock("./manifest.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof manifestModule>()),
  webAppManifestFrom: () => ({}),
}));

const ICON_FILE_NAMES = [
  "favicon.svg",
  "favicon.ico",
  "apple-touch-icon.png",
  "logo192.png",
  "logo512.png",
  "logo-maskable-512.png",
];

interface EmittedFile {
  fileName: string;
  source: Buffer | string;
}

const iconFilesWithContents = (contents: string): Array<IconFile> =>
  ICON_FILE_NAMES.map((fileName) => ({ fileName, mediaType: "image/png", manifestIcon: null, contents }));

function setUpSiteIcons() {
  iconFilesFrom.mockReset();

  const plugin = siteIconsPlugin();
  const middleware = devServerMiddlewareOf(plugin);

  const changeFile = (file: string) => (plugin.watchChange as unknown as (id: string) => void)(file);
  const servedFaviconContents = async () => (await devServerRequestFor(middleware, "/favicon.svg")).body;
  const emittedFaviconContents = async () => {
    const emittedFiles: Array<EmittedFile> = [];

    await (plugin.generateBundle as unknown as (this: unknown) => Promise<void>).call({
      environment: { name: CLIENT_ENVIRONMENT },
      emitFile: (file: EmittedFile) => emittedFiles.push(file),
    });

    return emittedFiles.find(({ fileName }) => fileName === "favicon.svg")?.source;
  };

  return { changeFile, servedFaviconContents, emittedFaviconContents };
}

describe("siteIconsPlugin", () => {
  test("emits the generated files into the client build", async () => {
    const { emittedFaviconContents } = setUpSiteIcons();

    iconFilesFrom.mockResolvedValueOnce(iconFilesWithContents("first"));

    expect(await emittedFaviconContents()).toBe("first");
  });

  test("serves the files it generated first when a file other than the artwork or the stylesheet is changed", async () => {
    const { changeFile, servedFaviconContents } = setUpSiteIcons();

    iconFilesFrom.mockResolvedValueOnce(iconFilesWithContents("first"));
    await servedFaviconContents();
    changeFile(fromRoot("src/app/root-document.tsx"));

    expect(await servedFaviconContents()).toBe("first");
    expect(iconFilesFrom).toHaveBeenCalledOnce();
  });

  test.each([
    ["artwork", ICON_ARTWORK_FILE_PATH],
    ["stylesheet", STYLESHEET_FILE_PATH],
  ])("generates the files again for the next request when the %s is changed", async (_, rootRelativePath) => {
    const { changeFile, servedFaviconContents } = setUpSiteIcons();

    iconFilesFrom
      .mockResolvedValueOnce(iconFilesWithContents("first"))
      .mockResolvedValueOnce(iconFilesWithContents("second"));
    await servedFaviconContents();
    changeFile(fromRoot(rootRelativePath));

    expect(await servedFaviconContents()).toBe("second");
  });
});
