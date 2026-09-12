import { createHash } from "node:crypto";

import sharp from "sharp";

import type { Dimensions } from "#/lib/content/media.ts";

import type { AvifOptions, WebpOptions } from "sharp";

export const IMAGE_ENCODING_OPTIONS = {
  avif: { quality: 80 },
  webp: {
    quality: 90,
    effort: 6,
    smartSubsample: true, // Reduces chroma artifacts in fine detail.
    alphaQuality: 100, // Encodes alpha edges losslessly.
  },
} as const satisfies { avif: AvifOptions; webp: WebpOptions };

export type ImageDerivativeFormat = "avif" | "webp";

export interface ImageDerivative {
  format: ImageDerivativeFormat;
  variant?: "thumbnail";
  width?: number; // Source dimensions are used when omitted.
  quality?: number; // Default quality for the format used when omitted.
}

export const BODY_IMAGE_DERIVATIVES: Array<ImageDerivative> = [{ format: "avif" }, { format: "webp" }]; // In `<picture>` preference order.
export const POSTER_IMAGE_DERIVATIVE: ImageDerivative = { format: "webp" };

interface ThumbnailImageDerivatives {
  alternates: Array<ImageDerivative>; // In `<picture>` preference order.
  fallback: ImageDerivative; // Fallback `<img>` source.
}

/** Cover-image derivatives at `width` (2x the rendered thumbnail width). */
export const thumbnailImageDerivativesFor = (width: number): ThumbnailImageDerivatives => ({
  alternates: [{ format: "avif", variant: "thumbnail", width }],
  fallback: { format: "webp", variant: "thumbnail", width },
});

export function imageDerivativeDimensionsOf({ width, height }: Dimensions, derivative: ImageDerivative): Dimensions {
  if (derivative.width === undefined || derivative.width >= width) {
    return { width, height };
  }

  return { width: derivative.width, height: Math.round((height * derivative.width) / width) };
}

export const imageDerivativeExtensionOf = ({ format }: ImageDerivative) => `.${format}` as const;

const imageEncodingOptionsOf = ({ format, quality }: ImageDerivative): AvifOptions | WebpOptions => ({
  ...IMAGE_ENCODING_OPTIONS[format],
  quality: quality ?? IMAGE_ENCODING_OPTIONS[format].quality,
});
const imageDerivativeSuffixOf = ({ format, variant }: ImageDerivative) => (variant ? `${variant}.${format}` : format);

export const imageDerivativeFingerprint = (derivative: ImageDerivative) =>
  createHash("sha256")
    .update(
      JSON.stringify([derivative.format, derivative.width ?? null, Object.entries(imageEncodingOptionsOf(derivative))]),
    )
    .digest("hex")
    .slice(0, 8);

/** Media storage filename: `<source hash>.<derivative fingerprint>.<suffix>`. */
export const imageDerivativeFileName = (hash: string, derivative: ImageDerivative) =>
  `${hash}.${imageDerivativeFingerprint(derivative)}.${imageDerivativeSuffixOf(derivative)}`;

/** Encodes one derivative of the image at `absolutePath` and returns its bytes. */
export async function encodeImageDerivative(absolutePath: string, derivative: ImageDerivative): Promise<Buffer> {
  const image = sharp(absolutePath, { autoOrient: true });
  const resized =
    derivative.width === undefined ? image : image.resize({ width: derivative.width, withoutEnlargement: true });

  return resized.toFormat(derivative.format, imageEncodingOptionsOf(derivative)).toBuffer();
}
