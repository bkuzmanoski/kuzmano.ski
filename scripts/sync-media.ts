import { join } from "node:path";

import { createImageDerivativeStore, imageDerivativeAuditBetween } from "../build/content/media/derivative-store.ts";
import { buildMediaIndex } from "../build/content/media/media-index.ts";
import { contentMediaProblemReport, fileSize } from "../build/content/media/problems.ts";
import { rootRelativePathOf } from "../build/content/media/renditions.ts";
import { MEDIA_DIRECTORY_PATH, fromRoot } from "../build/paths.ts";

// Syncs the media directory with the content directory; fails for derivatives exceeding Cloudflare's size limit.

const derivativeStore = createImageDerivativeStore(fromRoot(MEDIA_DIRECTORY_PATH));
const { renditionsByUrl, problems } = await buildMediaIndex();
const indexProblems = problems();

if (indexProblems.length > 0) {
  console.error(contentMediaProblemReport(indexProblems));
  process.exit(1);
}

let encodedCount = 0;

// Encoded one at a time: sharp already spreads each encoding across every core.
for (const rendition of renditionsByUrl.values()) {
  if (rendition.origin === "authored") {
    continue; // Served from the content directory as authored.
  }

  const encodedByteLength = await derivativeStore.encodeIfMissing(rendition);

  if (encodedByteLength === null) {
    continue; // Already generated, possibly for another URL served from the same bytes.
  }

  encodedCount += 1;

  console.log(`+ ${rootRelativePathOf(rendition)}  ${fileSize(encodedByteLength)}`);
}

const { staleDerivativeFileNames, sizeProblems } = imageDerivativeAuditBetween(
  renditionsByUrl.values(),
  await derivativeStore.storedByteLengths(),
);

for (const fileName of staleDerivativeFileNames) {
  await derivativeStore.remove(fileName);
  console.log(`- ${join(MEDIA_DIRECTORY_PATH, fileName)}`);
}

console.log(`${encodedCount} derivative(s) encoded, ${staleDerivativeFileNames.length} no longer required.`);

if (sizeProblems.length > 0) {
  console.error(contentMediaProblemReport(sizeProblems));
  process.exit(1);
}
