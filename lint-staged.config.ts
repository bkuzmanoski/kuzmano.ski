import { existsSync } from "node:fs";

import { CONTENT_MEDIA_EXTENSIONS } from "./build/content/media/formats.ts";
import { CONTENT_DIRECTORY_PATH, MEDIA_DIRECTORY_PATH } from "./build/paths.ts";

// Tasks the pre-commit hook runs on staged files (see `simple-git-hooks` in `package.json`).
// The hook should pass `--diff-filter=ACMRD` so that a deleted path reaches the generator below.

const CONTENT_FILE_EXTENSIONS = [...CONTENT_MEDIA_EXTENSIONS.map((extension) => extension.slice(1)), "mdx"];
const CONTENT_FILE_GLOB = `${CONTENT_DIRECTORY_PATH}/**/*.{${CONTENT_FILE_EXTENSIONS.join(",")}}`;

const onPresentFiles =
  (...commands: Array<string>) =>
  (filePaths: Array<string>) => {
    const presentFilePaths = filePaths.filter((filePath) => existsSync(filePath));
    return presentFilePaths.length === 0
      ? []
      : commands.map(
          (command) => `${command} ${presentFilePaths.map((filePath) => JSON.stringify(filePath)).join(" ")}`,
        );
  };

export default {
  "*.{ts,tsx}": onPresentFiles("eslint --fix", "prettier --write"),
  "*.css": onPresentFiles("stylelint --fix", "prettier --write"),
  "*.{md,mdx}": onPresentFiles("markdownlint-cli2 --fix --no-globs", "prettier --write"),
  "*.{json,jsonc,yml,yaml}": onPresentFiles("prettier --write"),
  [CONTENT_FILE_GLOB]: () => ["npm run sync-media", `git add ${MEDIA_DIRECTORY_PATH}`],
};
