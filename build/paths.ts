import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Resolves a repository-relative path against the root. */
export const fromRoot = (path: string) => join(ROOT_DIRECTORY, path);

/** Reduces an absolute path to a repository-relative one, for display. */
export const toRootRelative = (path: string) => relative(ROOT_DIRECTORY, path);

export const SOURCE_DIRECTORY = "src";
export const PUBLIC_DIRECTORY = "public";
export const CONTENT_DIRECTORY = "content";
export const STYLESHEET = "src/styles.css";
export const ICON_ARTWORK = "src/assets/images/logo.svg";
export const ICON_LOCK = "build/icons/lock.json";
