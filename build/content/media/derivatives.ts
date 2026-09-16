import { createHash } from "node:crypto";

import sharp from "sharp";

import type { Dimensions } from "#/lib/content/media.ts";

import type { AvifOptions, ResizeOptions, WebpOptions } from "sharp";

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
  shortestSideLength?: number; // Source dimensions are used when omitted.
  quality?: number; // Default quality for the format used when omitted.
}

/** The alternates a `<picture>` element's `<source>`s offer and the fallback its `<img>` serves. */
export interface PictureDerivatives {
  alternates: Array<ImageDerivative>; // In `<picture>` preference order.
  fallback: ImageDerivative | null; // `null` when the `<img>` serves the authored image.
}

export const BODY_IMAGE_DERIVATIVES: PictureDerivatives = {
  alternates: [{ format: "avif" }, { format: "webp" }],
  fallback: null,
};
export const POSTER_IMAGE_DERIVATIVE: ImageDerivative = { format: "webp" };

export const thumbnailImageDerivativesFor = (shortestSideLength: number): PictureDerivatives => ({
  alternates: [{ format: "avif", variant: "thumbnail", shortestSideLength }],
  fallback: { format: "webp", variant: "thumbnail", shortestSideLength },
});

export function imageDerivativeDimensionsOf({ width, height }: Dimensions, derivative: ImageDerivative): Dimensions {
  const { shortestSideLength } = derivative;

  if (shortestSideLength === undefined || shortestSideLength >= Math.min(width, height)) {
    return { width, height };
  }

  return width <= height
    ? { width: shortestSideLength, height: Math.round((height * shortestSideLength) / width) }
    : { width: Math.round((width * shortestSideLength) / height), height: shortestSideLength };
}

export const imageDerivativeExtensionOf = ({ format }: ImageDerivative) => `.${format}` as const;

const imageResizeOptionsOf = ({ shortestSideLength }: ImageDerivative): ResizeOptions | null =>
  shortestSideLength === undefined
    ? null
    : { width: shortestSideLength, height: shortestSideLength, fit: "outside", withoutEnlargement: true };
const imageEncodingOptionsOf = ({ format, quality }: ImageDerivative): AvifOptions | WebpOptions => ({
  ...IMAGE_ENCODING_OPTIONS[format],
  quality: quality ?? IMAGE_ENCODING_OPTIONS[format].quality,
});

export const imageDerivativeFingerprint = (derivative: ImageDerivative) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        derivative.format,
        Object.entries(imageResizeOptionsOf(derivative) ?? {}),
        Object.entries(imageEncodingOptionsOf(derivative)),
      ]),
    )
    .digest("hex")
    .slice(0, 8);

const imageDerivativeSuffixOf = ({ format, variant }: ImageDerivative) => (variant ? `${variant}.${format}` : format);

/** Media storage filename: `<image hash>.<derivative fingerprint>.<suffix>`. */
export const imageDerivativeFileName = (hash: string, derivative: ImageDerivative) =>
  `${hash}.${imageDerivativeFingerprint(derivative)}.${imageDerivativeSuffixOf(derivative)}`;

/** Encodes one derivative of the image at `absolutePath` and returns its bytes. */
export async function encodeImageDerivative(absolutePath: string, derivative: ImageDerivative): Promise<Buffer> {
  const image = sharp(absolutePath, { autoOrient: true });
  const resizeOptions = imageResizeOptionsOf(derivative);
  const resizedImage = resizeOptions === null ? image : image.resize(resizeOptions);

  return resizedImage.toFormat(derivative.format, imageEncodingOptionsOf(derivative)).toBuffer();
}
