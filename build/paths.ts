import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..");
export const STYLESHEET = join(ROOT_DIRECTORY, "src/styles.css");
