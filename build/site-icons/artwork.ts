import { readFile } from "node:fs/promises";

import { fromHtml } from "hast-util-from-html";
import { select, selectAll } from "hast-util-select";

import { ICON_ARTWORK_FILE_PATH, fromRoot } from "../paths.ts";

export interface Artwork {
  width: number;
  height: number;
  path: string;
}

const MONOGRAM_SELECTOR = "path.background"; // The path drawing the monogram in `ICON_ARTWORK_FILE_PATH`.

function boundsIn(viewBox: string): { width: number; height: number } {
  const viewBoxNumbers = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width = 0, height = 0] = viewBoxNumbers;

  if (
    viewBoxNumbers.length !== 4 ||
    viewBoxNumbers.some((value) => !Number.isFinite(value)) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `${ICON_ARTWORK_FILE_PATH} has the viewBox \`${viewBox}\`, which is not four numbers with a positive size.`,
    );
  }

  return { width, height };
}

export function artworkIn(markup: string): Artwork {
  const artworkTree = fromHtml(markup, { fragment: true, space: "svg" });
  const svg = select("svg", artworkTree);

  if (!svg) {
    throw new Error(`${ICON_ARTWORK_FILE_PATH} has no \`<svg>\` element.`);
  }

  const { viewBox } = svg.properties;

  if (typeof viewBox !== "string") {
    throw new Error(`${ICON_ARTWORK_FILE_PATH} has no \`viewBox\`.`);
  }

  const monograms = selectAll(MONOGRAM_SELECTOR, artworkTree);

  if (monograms.length !== 1) {
    throw new Error(
      `${ICON_ARTWORK_FILE_PATH} has ${monograms.length} \`${MONOGRAM_SELECTOR}\` elements, and needs exactly one.`,
    );
  }

  const monogramPath = monograms[0]?.properties.d;

  if (typeof monogramPath !== "string" || monogramPath === "") {
    throw new Error(`${ICON_ARTWORK_FILE_PATH} has a \`${MONOGRAM_SELECTOR}\` with no path data.`);
  }

  return { ...boundsIn(viewBox), path: monogramPath };
}

export const readArtwork = async (): Promise<Artwork> =>
  artworkIn(await readFile(fromRoot(ICON_ARTWORK_FILE_PATH), "utf8"));
