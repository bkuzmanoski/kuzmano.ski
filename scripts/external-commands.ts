import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

export const runCommand = promisify(execFile);

const HOMEBREW_FORMULAE_BY_COMMAND: Record<string, string | undefined> = { jpegtran: "jpeg-turbo" }; // Formulae named differently from the command they install.

const isExecutable = (filePath: string) =>
  access(filePath, constants.X_OK).then(
    () => true,
    () => false,
  );

async function isInstalled(command: string) {
  const directoryPaths = (process.env.PATH ?? "").split(delimiter).filter((directoryPath) => directoryPath !== "");
  const executableResults = await Promise.all(
    directoryPaths.map((directoryPath) => isExecutable(join(directoryPath, command))),
  );

  return executableResults.includes(true);
}

export async function requireCommands(...commands: Array<string>) {
  const installedResults = await Promise.all(commands.map(isInstalled));
  const missingCommands = commands.filter((_command, index) => !installedResults[index]);

  if (missingCommands.length === 0) {
    return;
  }

  const homebrewFormulae = new Set(missingCommands.map((command) => HOMEBREW_FORMULAE_BY_COMMAND[command] ?? command));

  throw new Error(
    `Missing commands: ${missingCommands.join(", ")}. Install with \`brew install ${[...homebrewFormulae].join(" ")}\`.`,
  );
}
