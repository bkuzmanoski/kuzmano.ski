import { constants, existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { errorMessageOf } from "#/lib/errors.ts";

import { isImageDerivativeFileName } from "../build/content/media/derivatives.ts";
import { buildMediaIndex } from "../build/content/media/media-index.ts";
import { CONTENT_DIRECTORY_PATH, MEDIA_DIRECTORY_PATH, fromRoot } from "../build/paths.ts";

import { runCommand } from "./helpers/external-commands.ts";

// Keeps a commit's `/media` aligned with its staged content by staging required derivatives and removing stale ones. It
// runs `prepare-media` against an index checkout because the working tree may contain uncommitted content.
//
// The pre-commit hook runs this after lint-staged because lint-staged would stage every tracked-file change it makes,
// including removal of derivatives still required by unstaged working-tree content.

const ROOT_DIRECTORY_ABSOLUTE_PATH = fromRoot("");

// Paths checked by `--if-media-inputs-staged` in the pre-commit hook. Other media pipeline changes can still affect
// derivatives; running without the flag stages any resulting derivatives.
const MEDIA_INPUT_PATHS = [CONTENT_DIRECTORY_PATH, MEDIA_DIRECTORY_PATH, "build/content/media"];

const REGULAR_FILE_MODES = new Set(["100644", "100755"]);

const runGit = (gitArguments: Array<string>, environment: NodeJS.ProcessEnv = process.env) =>
  runCommand("git", gitArguments, { cwd: ROOT_DIRECTORY_ABSOLUTE_PATH, env: environment });
const mediaPathOf = (fileName: string) => join(MEDIA_DIRECTORY_PATH, fileName);

// Resolves symlinks so alternate spellings of an index path compare equal.
const canonicalPathOf = (path: string) => (existsSync(path) ? realpathSync(path) : path);

const isHiddenFileName = (fileName: string) => fileName.startsWith(".");
const nulSeparatedFieldsIn = (output: string) => output.split("\0").filter((field) => field !== "");

// Parses a `git ls-files --stage` line (`<mode> <object ID> <stage>\t<path>`).
function indexEntryOf(line: string) {
  const [mode = "", objectId = ""] = line.slice(0, line.indexOf("\t")).split(" ");
  return { mode, objectId, path: line.slice(line.indexOf("\t") + 1) };
}

function runGitWithInput(gitArguments: Array<string>, input: string, environment: NodeJS.ProcessEnv = process.env) {
  const pendingCommand = runGit(gitArguments, environment);

  pendingCommand.child.stdin?.end(input);

  return pendingCommand;
}

async function fileNamesIn(directoryAbsolutePath: string) {
  if (!existsSync(directoryAbsolutePath)) {
    return [];
  }

  return (await readdir(directoryAbsolutePath)).filter((fileName) => !isHiddenFileName(fileName));
}

async function hasStagedMediaInputChanges() {
  const { stdout } = await runGit(["diff", "--cached", "--name-only", "-z", "--", ...MEDIA_INPUT_PATHS]);
  return stdout !== "";
}

async function stagedMediaFileNames() {
  const { stdout } = await runGit(["ls-files", "-z", "--", MEDIA_DIRECTORY_PATH]);
  return nulSeparatedFieldsIn(stdout)
    .map((path) => path.slice(MEDIA_DIRECTORY_PATH.length + 1))
    .filter((fileName) => !isHiddenFileName(fileName));
}

// Returns the env(s) for each Git index to update. For `git commit <paths>`, Git runs hooks against a temporary index
// while locking the default index as `index.lock`; staging in both keeps the default index in sync. Fails if an unknown
// active index has no `index.lock`.
async function indexEnvironments(): Promise<Array<NodeJS.ProcessEnv>> {
  const { GIT_INDEX_FILE: activeIndexFileVariable, ...environmentWithoutIndexFile } = process.env;
  const { stdout } = await runGit(
    ["rev-parse", "--path-format=absolute", "--git-path", "index", "--git-path", "index.lock"],
    environmentWithoutIndexFile, // `--git-path index` returns `GIT_INDEX_FILE` if it is set, so the default index is read without it.
  );
  const [defaultIndexFilePath = "", defaultIndexLockFilePath = ""] = stdout.trim().split("\n").map(canonicalPathOf);
  const activeIndexFilePath = canonicalPathOf(
    resolve(ROOT_DIRECTORY_ABSOLUTE_PATH, activeIndexFileVariable ?? defaultIndexFilePath),
  );

  if (activeIndexFilePath === defaultIndexFilePath || activeIndexFilePath === defaultIndexLockFilePath) {
    return [process.env];
  }

  if (!existsSync(defaultIndexLockFilePath)) {
    throw new Error(
      `Cannot determine which index the commit will retain: "${activeIndexFilePath}" is not the default index, and the default index is not locked. Commit without specifying paths.`,
    );
  }

  return [process.env, { ...process.env, GIT_INDEX_FILE: defaultIndexLockFilePath }];
}

// Materializes the Git index under `snapshotDirectoryPath`, cloning unchanged files from the working tree and checking
// out the rest from the index. Hashes each clone against its index object ID because `git diff` ignores clean-filter
// and line-ending differences.
async function writeIndexSnapshot(snapshotDirectoryPath: string) {
  const [{ stdout: indexListing }, { stdout: unstagedChangeListing }] = await Promise.all([
    runGit(["ls-files", "--stage", "-z"]),
    runGit(["diff", "--name-only", "-z"]),
  ]);
  const unstagedChangePaths = new Set(nulSeparatedFieldsIn(unstagedChangeListing));
  const indexEntries = nulSeparatedFieldsIn(indexListing).map(indexEntryOf);
  const cloneCandidateEntries = indexEntries.filter(
    ({ mode, path }) => REGULAR_FILE_MODES.has(mode) && !unstagedChangePaths.has(path) && !path.includes("\n"),
  ); // `hash-object --stdin-paths` reads one path per line, so a path containing a line break is checked out instead.
  const cloneDirectoryPaths = new Set(
    cloneCandidateEntries.map(({ path }) => dirname(join(snapshotDirectoryPath, path))),
  );

  await Promise.all([...cloneDirectoryPaths].map((directoryPath) => mkdir(directoryPath, { recursive: true })));

  // `git diff` does not report every file missing from the working tree (e.g., one marked assume-unchanged or outside a
  // sparse checkout), so a file that fails to clone is checked out instead.
  const isClonedResults = await Promise.all(
    cloneCandidateEntries.map(({ path }) =>
      copyFile(fromRoot(path), join(snapshotDirectoryPath, path), constants.COPYFILE_FICLONE).then(
        () => true,
        () => false,
      ),
    ),
  );
  const clonedEntries = cloneCandidateEntries.filter((_entry, index) => isClonedResults[index]);

  const { stdout: cloneObjectIdListing } =
    clonedEntries.length === 0
      ? { stdout: "" }
      : await runGitWithInput(
          ["hash-object", "--no-filters", "--stdin-paths"],
          clonedEntries.map(({ path }) => `${join(snapshotDirectoryPath, path)}\n`).join(""),
        );
  const cloneObjectIds = cloneObjectIdListing.split("\n"); // One per path, in order.
  const verifiedClonePaths = new Set(
    clonedEntries.filter(({ objectId }, index) => cloneObjectIds[index] === objectId).map(({ path }) => path),
  );
  const checkedOutPaths = indexEntries.map(({ path }) => path).filter((path) => !verifiedClonePaths.has(path));

  if (checkedOutPaths.length > 0) {
    await runGitWithInput(
      [
        "checkout-index",
        "--force", // Replaces a clone whose bytes differ from the index
        "--ignore-skip-worktree-bits", // Writes the entries a sparse checkout leaves out of the working tree.
        "-z",
        "--stdin",
        `--prefix=${snapshotDirectoryPath}/`,
      ],
      checkedOutPaths.map((path) => `${path}\0`).join(""),
    );
  }
}

// Applies additions and removals in one `update-index` call per index. Because Git updates the temporary index before
// the default index during `git commit <paths>`, a failure in either aborts the commit cleanly.
async function updateIndexes(
  indexEnvironmentList: Array<NodeJS.ProcessEnv>,
  addedFileNames: Array<string>,
  removedFileNames: Array<string>,
) {
  const addedPaths = addedFileNames.map(mediaPathOf);
  const removedPaths = removedFileNames.map(mediaPathOf);
  const { stdout: objectIdListing } =
    addedPaths.length === 0 ? { stdout: "" } : await runGit(["hash-object", "-w", "--", ...addedPaths]); // Writes the blobs before any index refers to them. `git gc` prunes them if no index update follows.
  const objectIds = objectIdListing.split("\n").filter((objectId) => objectId !== ""); // One per path, in order.
  const { stdout: objectFormat } = await runGit(["rev-parse", "--show-object-format"]);
  const nullObjectId = "0".repeat(objectFormat.trim() === "sha256" ? 64 : 40);
  const indexInfo = [
    ...addedPaths.map((path, index) => `100644 ${objectIds[index]}\t${path}\0`),
    ...removedPaths.map((path) => `0 ${nullObjectId}\t${path}\0`), // Mode 0 removes the entry.
  ].join("");

  for (const environment of indexEnvironmentList) {
    await runGitWithInput(["update-index", "-z", "--index-info"], indexInfo, environment);
  }
}

// Returns derivative file names required by staged content, or reports an error and returns `null`.
async function requiredDerivativeFileNamesIn(snapshotDirectoryPath: string) {
  const snapshotMediaDirectoryPath = join(snapshotDirectoryPath, MEDIA_DIRECTORY_PATH);

  await writeIndexSnapshot(snapshotDirectoryPath);
  await symlink(fromRoot("node_modules"), join(snapshotDirectoryPath, "node_modules"));

  // Reuses working-tree derivatives so `prepare-media` needs to encode only missing files. Only files with derivative
  // names are copied, because `prepare-media` removes only those as stale, and any file left in the snapshot is staged
  // as required.
  const workingTreeDerivativeFileNames = (await fileNamesIn(fromRoot(MEDIA_DIRECTORY_PATH))).filter(
    (fileName) => isImageDerivativeFileName(fileName) && !existsSync(join(snapshotMediaDirectoryPath, fileName)),
  );

  await mkdir(snapshotMediaDirectoryPath, { recursive: true });
  await Promise.all(
    workingTreeDerivativeFileNames.map((fileName) =>
      copyFile(
        fromRoot(mediaPathOf(fileName)),
        join(snapshotMediaDirectoryPath, fileName),
        constants.COPYFILE_FICLONE, // A copy-on-write clone where the file system supports one.
      ),
    ),
  );

  try {
    await runCommand("node", [join("scripts", "prepare-media.ts")], { cwd: snapshotDirectoryPath });
  } catch (cause) {
    const { stdout = "", stderr = "" } = cause as { stdout?: string; stderr?: string };

    console.error(`Could not prepare media for the staged content.\n\n${stdout}${stderr}`);

    return null;
  }

  return new Set(await fileNamesIn(snapshotMediaDirectoryPath));
}

async function stageMedia(snapshotDirectoryPath: string) {
  const indexEnvironmentList = await indexEnvironments();
  const requiredFileNames = await requiredDerivativeFileNamesIn(snapshotDirectoryPath);

  if (requiredFileNames === null) {
    process.exitCode = 1;
    return;
  }

  const stagedFileNames = new Set(await stagedMediaFileNames());
  const addedFileNames = [...requiredFileNames].filter((fileName) => !stagedFileNames.has(fileName));
  const removedFileNames = [...stagedFileNames].filter((fileName) => !requiredFileNames.has(fileName));

  if (addedFileNames.length + removedFileNames.length === 0) {
    return;
  }

  if (addedFileNames.length > 0) {
    await mkdir(fromRoot(MEDIA_DIRECTORY_PATH), { recursive: true });
    await Promise.all(
      addedFileNames.map((fileName) =>
        copyFile(join(snapshotDirectoryPath, mediaPathOf(fileName)), fromRoot(mediaPathOf(fileName))),
      ),
    );
  }

  await updateIndexes(indexEnvironmentList, addedFileNames, removedFileNames);

  if (removedFileNames.length > 0) {
    const { renditionsByUrl } = await buildMediaIndex();
    const workingTreeDerivativeFileNames = new Set(
      [...renditionsByUrl.values()].flatMap((rendition) =>
        rendition.origin === "derivative" ? [rendition.derivativeFileName] : [],
      ),
    ); // The working tree keeps a removed derivative that its own content still requires.

    await Promise.all(
      removedFileNames
        .filter((fileName) => !workingTreeDerivativeFileNames.has(fileName))
        .map((fileName) => rm(fromRoot(mediaPathOf(fileName)), { force: true })),
    );
  }

  addedFileNames.forEach((fileName) => console.log(`+ ${mediaPathOf(fileName)}`));
  removedFileNames.forEach((fileName) => console.log(`- ${mediaPathOf(fileName)}`));
  console.log(
    `\nStaged ${addedFileNames.length} derivative(s) and the removal of ${removedFileNames.length} stale derivative(s).`,
  );
}

try {
  const { values } = parseArgs({ options: { "if-media-inputs-staged": { type: "boolean" } } });

  if (!values["if-media-inputs-staged"] || (await hasStagedMediaInputChanges())) {
    const snapshotDirectoryPath = await mkdtemp(join(tmpdir(), "stage-media-"));

    try {
      await stageMedia(snapshotDirectoryPath);
    } finally {
      await rm(snapshotDirectoryPath, { recursive: true, force: true });
    }
  }
} catch (cause) {
  console.error(`Could not stage media.\n\n${errorMessageOf(cause)}`);
  process.exitCode = 1;
}
