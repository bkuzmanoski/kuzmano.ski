import { readdir, stat } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";

interface InputPathOptions {
  isRecursive: boolean;
  isIncludedDirectoryFile: (filePath: string) => boolean;
}

const isHiddenPath = (path: string) => path.split(sep).some((segment) => segment.startsWith("."));

async function filePathsIn(directoryPath: string, isRecursive: boolean) {
  const directoryItems = await readdir(directoryPath, { withFileTypes: true, recursive: isRecursive });
  return directoryItems
    .filter((directoryItem) => directoryItem.isFile())
    .map((directoryItem) => join(directoryItem.parentPath, directoryItem.name))
    .filter((filePath) => !isHiddenPath(relative(directoryPath, filePath)))
    .sort();
}

export async function inputFilePathsOf(
  inputPaths: Array<string>,
  { isRecursive, isIncludedDirectoryFile }: InputPathOptions,
): Promise<Array<string>> {
  const inputFilePaths = new Set<string>();

  for (const inputPath of inputPaths) {
    if (!(await stat(inputPath)).isDirectory()) {
      inputFilePaths.add(normalize(inputPath));
      continue;
    }

    for (const filePath of await filePathsIn(inputPath, isRecursive)) {
      if (isIncludedDirectoryFile(filePath)) {
        inputFilePaths.add(filePath);
      }
    }
  }

  return [...inputFilePaths];
}
