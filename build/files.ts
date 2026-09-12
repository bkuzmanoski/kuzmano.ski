import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function writeFileAtomically(filePath: string, write: (temporaryFilePath: string) => Promise<unknown>) {
  const temporaryFilePath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);

  try {
    await write(temporaryFilePath);
    await rename(temporaryFilePath, filePath);
  } catch (cause) {
    await rm(temporaryFilePath, { force: true });
    throw cause;
  }
}
