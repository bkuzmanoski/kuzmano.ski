import type { MediaKind } from "#/lib/content/media.ts";

export const COVER_IMAGE_STEM_SUFFIX = ".cover";
export const VIDEO_POSTER_IMAGE_STEM_SUFFIX = ".poster";

export const IMAGE_MEDIA_TYPES = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
} as const;

const VIDEO_MEDIA_TYPES = { ".mp4": "video/mp4" } as const;
const MEDIA_TYPES: Record<string, string | undefined> = { ...IMAGE_MEDIA_TYPES, ...VIDEO_MEDIA_TYPES };
const ENCODABLE_IMAGE_EXTENSIONS: Array<string> = [".jpeg", ".jpg", ".png"]; // Images in these formats have derivatives. Images in other formats are served as authored.

export const CONTENT_MEDIA_EXTENSIONS = Object.keys(MEDIA_TYPES);

const FILE_EXTENSION = /\.[^./]*$/;

export const authoredExtensionOf = (filePath: string) => FILE_EXTENSION.exec(filePath)?.[0] ?? "";
const extensionOf = (filePath: string) => authoredExtensionOf(filePath).toLowerCase();
export const withoutExtension = (filePath: string) =>
  filePath.slice(0, filePath.length - authoredExtensionOf(filePath).length);
export const mediaTypeOf = (filePath: string): string | null => MEDIA_TYPES[extensionOf(filePath)] ?? null;
export const isEncodableImage = (filePath: string) => ENCODABLE_IMAGE_EXTENSIONS.includes(extensionOf(filePath));
export const coverImageStemOf = (slug: string) => `${slug}${COVER_IMAGE_STEM_SUFFIX}`;
export const posterImageStemOf = (videoFilePath: string) =>
  `${withoutExtension(videoFilePath)}${VIDEO_POSTER_IMAGE_STEM_SUFFIX}`;

function mediaKindOf(filePath: string): MediaKind | null {
  const extension = extensionOf(filePath);

  if (extension in IMAGE_MEDIA_TYPES) {
    return "image";
  }

  return extension in VIDEO_MEDIA_TYPES ? "video" : null;
}

export const isImage = (filePath: string) => mediaKindOf(filePath) === "image";
export const isVideo = (filePath: string) => mediaKindOf(filePath) === "video";
export const isContentMedia = (filePath: string) => mediaKindOf(filePath) !== null;
