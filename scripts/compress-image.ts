import { stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  BODY_IMAGE_DERIVATIVES,
  IMAGE_ENCODING_OPTIONS,
  encodeImageDerivative,
  imageDerivativeExtensionOf,
} from "../build/content/media/derivatives.ts";
import { isSourceImage, withoutExtension } from "../build/content/media/formats.ts";
import { fileSize } from "../build/content/media/problems.ts";

import { wholeNumberOption } from "./arguments.ts";

import type { ImageDerivative, ImageDerivativeFormat } from "../build/content/media/derivatives.ts";

// Encodes a PNG or JPEG image into an AVIF and WebP pair, writing both beside the source file.

const USAGE = `Usage: node scripts/compress-image.ts [OPTIONS] <image.{png,jpg}>...

Options:
  --avif-quality <n>    AVIF quality, 0-100 (default: ${IMAGE_ENCODING_OPTIONS.avif.quality})
  --webp-quality <n>    WebP quality, 0-100 (default: ${IMAGE_ENCODING_OPTIONS.webp.quality})
  -h, --help            Show this message`;

interface Arguments {
  inputFilePaths: Array<string>;
  qualityByFormat: Partial<Record<ImageDerivativeFormat, number>>;
}

function parseArguments(args: Array<string>): Arguments {
  const { values, positionals: inputFilePaths } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "avif-quality": { type: "string" },
      "webp-quality": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return process.exit(0);
  }

  if (inputFilePaths.length === 0) {
    throw new Error(USAGE);
  }

  return {
    inputFilePaths,
    qualityByFormat: {
      avif: wholeNumberOption("avif-quality", values["avif-quality"], 100),
      webp: wholeNumberOption("webp-quality", values["webp-quality"], 100),
    },
  };
}

const outputFilePathOf = (inputFilePath: string, derivative: ImageDerivative) =>
  `${withoutExtension(inputFilePath)}${imageDerivativeExtensionOf(derivative)}`;

async function compress(inputFilePath: string, qualityByFormat: Arguments["qualityByFormat"]) {
  if (!isSourceImage(inputFilePath)) {
    throw new Error(`${inputFilePath} is not a PNG or a JPEG.`);
  }

  console.log(`${inputFilePath} (${fileSize((await stat(inputFilePath)).size)})`);

  for (const derivative of BODY_IMAGE_DERIVATIVES) {
    const outputFilePath = outputFilePathOf(inputFilePath, derivative);
    const encodedBytes = await encodeImageDerivative(resolve(inputFilePath), {
      ...derivative,
      quality: qualityByFormat[derivative.format],
    });

    await writeFile(outputFilePath, encodedBytes);

    console.log(`  → ${outputFilePath}  ${fileSize(encodedBytes.byteLength)}`);
  }
}

try {
  const { inputFilePaths, qualityByFormat } = parseArguments(process.argv.slice(2));

  for (const inputFilePath of inputFilePaths) {
    await compress(inputFilePath, qualityByFormat);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
