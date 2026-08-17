import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTENT_DIRECTORY = "src/content";
export const STYLESHEET = "src/styles.css";
