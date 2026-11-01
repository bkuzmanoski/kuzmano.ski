import { createHash } from "node:crypto";

import sharp from "sharp";

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
  /** Default quality for the format used when omitted. */
  quality?: number;
}

/** The derivatives a body image's `<picture>` lists in its `<source>`s, in preference order. */
export const BODY_IMAGE_ALTERNATES: Array<ImageDerivative> = [{ format: "avif" }, { format: "webp" }];

export const POSTER_IMAGE_DERIVATIVE: ImageDerivative = { format: "webp" };

export const imageDerivativeExtensionOf = ({ format }: ImageDerivative) => `.${format}` as const;

const imageEncodingOptionsOf = ({ format, quality }: ImageDerivative): AvifOptions | WebpOptions => ({
  ...IMAGE_ENCODING_OPTIONS[format],
  quality: quality ?? IMAGE_ENCODING_OPTIONS[format].quality,
});

export const imageDerivativeFingerprint = (derivative: ImageDerivative) =>
  createHash("sha256")
    .update(JSON.stringify([derivative.format, [], Object.entries(imageEncodingOptionsOf(derivative))])) // The empty array retains the fingerprints of the committed derivatives as changing this input renames all of them.
    .digest("hex")
    .slice(0, 8);

/** Media storage filename: `<image hash>.<derivative fingerprint>.<format>`. */
export const imageDerivativeFileName = (hash: string, derivative: ImageDerivative) =>
  `${hash}.${imageDerivativeFingerprint(derivative)}.${derivative.format}`;

const IMAGE_DERIVATIVE_FILE_NAME = /^[0-9a-f]+\.[0-9a-f]+\.[a-z0-9]+$/;

/** Whether `fileName` has the form `imageDerivativeFileName` produces, for any image and derivative. */
export const isImageDerivativeFileName = (fileName: string) => IMAGE_DERIVATIVE_FILE_NAME.test(fileName);

/** Encodes one derivative of the image at `absolutePath` and returns its bytes. */
export async function encodeImageDerivative(absolutePath: string, derivative: ImageDerivative): Promise<Buffer> {
  return sharp(absolutePath, { autoOrient: true })
    .toFormat(derivative.format, imageEncodingOptionsOf(derivative))
    .toBuffer();
}
