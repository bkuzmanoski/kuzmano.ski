import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Resolves a repository-relative path against the root. */
export const fromRoot = (path: string) => join(ROOT_DIRECTORY, path);

export const PUBLIC_DIRECTORY = "public";
export const CONTENT_DIRECTORY = "src/content";
export const STYLESHEET = "src/styles.css";
export const ICON_ARTWORK = "src/assets/images/logo.svg";
export const ICON_LOCK = "build/icons/lock.json";
