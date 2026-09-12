import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY_ABSOLUTE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SOURCE_DIRECTORY_PATH = "src";
export const CONTENT_DIRECTORY_PATH = "content";
export const MEDIA_DIRECTORY_PATH = "media";
export const STYLESHEET_FILE_PATH = "src/styles.css";
export const ICON_ARTWORK_FILE_PATH = "src/assets/images/logo.svg";

/** Resolves a repository-relative path against the root. */
export const fromRoot = (rootRelativePath: string) => join(ROOT_DIRECTORY_ABSOLUTE_PATH, rootRelativePath);

/** Reduces an absolute path to a repository-relative one, for display. */
export const toRootRelative = (absolutePath: string) => relative(ROOT_DIRECTORY_ABSOLUTE_PATH, absolutePath);

/** Resolves a path relative to the content directory against the root. */
export const fromContent = (...segments: Array<string>) => fromRoot(join(CONTENT_DIRECTORY_PATH, ...segments));

/** A path relative to the content directory, as a quoted repository-relative path for a problem message. */
export const quotedContentPath = (...segments: Array<string>) => `"${join(CONTENT_DIRECTORY_PATH, ...segments)}"`;

/** Returns a request path without its query so middleware matches the same file. */
export const requestPathOf = ({ url }: { url?: string | undefined }) => url?.split("?")[0];
