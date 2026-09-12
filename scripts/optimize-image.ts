import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";

import sharp from "sharp";

import { fileSize } from "../build/content/media/problems.ts";
import { writeFileAtomically } from "../build/files.ts";

import { wholeNumberOption } from "./arguments.ts";
import { requireCommands, runCommand } from "./external-commands.ts";
import { inputFilePathsOf } from "./files.ts";

// Optimizes PNG and JPEG images in place (for images that are served as authored).

const USAGE = `Usage: node scripts/optimize-image.ts [OPTIONS] <image.{png,jpg}|directory>...

Options:
  --jpeg-quality <n>    Re-encode JPEGs above this quality, 0-100; lower is smaller (default: lossless)
  --zopfli              Compress PNGs with Zopfli, which is slower but smaller
  -r, --recursive       Include images in the subdirectories of a directory
  -h, --help            Show this message`;

type ImageFormat = "jpeg" | "png";

interface OptimizationOptions {
  jpegQuality: number | undefined;
  usesZopfli: boolean;
}

interface Arguments extends OptimizationOptions {
  inputPaths: Array<string>;
  isRecursive: boolean;
}

interface ImageOptimization {
  imageFilePath: string;
  format: ImageFormat;
  orientation: number; // The Exif orientation, where 1 is upright.
}

const JPEG_TRANSFORMATION_ARGUMENTS_BY_ORIENTATION: Record<number, Array<string> | undefined> = {
  2: ["-flip", "horizontal"],
  3: ["-rotate", "180"],
  4: ["-flip", "vertical"],
  5: ["-transpose"],
  6: ["-rotate", "90"],
  7: ["-transverse"],
  8: ["-rotate", "270"],
};

function parseArguments(args: Array<string>): Arguments {
  const { values, positionals: inputPaths } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "jpeg-quality": { type: "string" },
      zopfli: { type: "boolean" },
      recursive: { type: "boolean", short: "r" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return process.exit(0);
  }

  if (inputPaths.length === 0) {
    throw new Error(USAGE);
  }

  return {
    inputPaths,
    jpegQuality: wholeNumberOption("jpeg-quality", values["jpeg-quality"], 100),
    usesZopfli: values.zopfli ?? false,
    isRecursive: values.recursive ?? false,
  };
}

function imageFormatOf(filePath: string): ImageFormat | null {
  switch (extname(filePath).toLowerCase()) {
    case ".jpeg":
    case ".jpg":
      return "jpeg";
    case ".png":
      return "png";
    default:
      return null;
  }
}

const requiredCommandsOf = ({ format, orientation }: ImageOptimization) =>
  format === "png"
    ? ["oxipng"]
    : [...(JPEG_TRANSFORMATION_ARGUMENTS_BY_ORIENTATION[orientation] ? ["jpegtran"] : []), "jpegoptim"];

async function applyJpegOrientation(imageFilePath: string, orientation: number) {
  const transformationArguments = JPEG_TRANSFORMATION_ARGUMENTS_BY_ORIENTATION[orientation];

  if (!transformationArguments) {
    return;
  }

  try {
    await writeFileAtomically(imageFilePath, (temporaryFilePath) =>
      runCommand("jpegtran", [
        ...["-copy", "icc", "-perfect", ...transformationArguments], // `-perfect` fails rather than leave partial blocks along a transformed edge in their original orientation.
        ...["-outfile", temporaryFilePath, resolve(imageFilePath)],
      ]),
    );
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("transformation is not perfect")) {
      throw new Error(
        `${imageFilePath} cannot be rotated losslessly to apply its orientation tag because its dimensions are not multiples of its JPEG block size.`,
      );
    }

    throw cause;
  }
}

async function applyPngOrientation(imageFilePath: string, orientation: number) {
  if (orientation === 1) {
    return;
  }

  await writeFileAtomically(imageFilePath, (temporaryFilePath) =>
    sharp(imageFilePath, { autoOrient: true }).keepIccProfile().png().toFile(temporaryFilePath),
  );
}

async function optimize(
  { imageFilePath, format, orientation }: ImageOptimization,
  { jpegQuality, usesZopfli }: OptimizationOptions,
) {
  if (format === "jpeg") {
    await applyJpegOrientation(imageFilePath, orientation); // The orientation tag is applied to the pixels first because stripping the metadata removes it.
    await runCommand("jpegoptim", [
      ...["--quiet", "--all-progressive", "--strip-all", "--keep-icc"],
      "--force", // Writes the result even when a progressive encoding is larger, so the metadata is always stripped.
      ...(jpegQuality === undefined ? [] : [`--max=${jpegQuality}`]),
      resolve(imageFilePath),
    ]);

    return;
  }

  await applyPngOrientation(imageFilePath, orientation);
  await runCommand("oxipng", [
    ...["--quiet", "--strip", "safe", ...(usesZopfli ? ["--zopfli"] : [])],
    resolve(imageFilePath),
  ]);
}

try {
  const { inputPaths, isRecursive, ...optimizationOptions } = parseArguments(process.argv.slice(2));
  const imageFilePaths = await inputFilePathsOf(inputPaths, {
    isRecursive,
    isIncludedDirectoryFile: (filePath) => imageFormatOf(filePath) !== null,
  });
  const imageOptimizations: Array<ImageOptimization> = [];

  for (const imageFilePath of imageFilePaths) {
    const format = imageFormatOf(imageFilePath);

    if (format === null) {
      throw new Error(`${imageFilePath} is not a PNG or a JPEG.`);
    }

    const { orientation = 1 } = await sharp(imageFilePath).metadata();

    imageOptimizations.push({ imageFilePath, format, orientation });
  }

  if (imageOptimizations.length === 0) {
    throw new Error("No PNG or JPEG images were found.");
  }

  await requireCommands(...new Set(imageOptimizations.flatMap(requiredCommandsOf)));

  let totalBytesBefore = 0;
  let totalBytesAfter = 0;

  for (const imageOptimization of imageOptimizations) {
    const { imageFilePath } = imageOptimization;
    const bytesBefore = (await stat(imageFilePath)).size;

    await optimize(imageOptimization, optimizationOptions);

    const bytesAfter = (await stat(imageFilePath)).size;

    totalBytesBefore += bytesBefore;
    totalBytesAfter += bytesAfter;

    console.log(`${imageFilePath}  ${fileSize(bytesBefore)} → ${fileSize(bytesAfter)}`);
  }

  const percentageSaved = Math.round(((totalBytesBefore - totalBytesAfter) / Math.max(totalBytesBefore, 1)) * 100);

  console.log(
    `${imageOptimizations.length} image(s) optimized: ${fileSize(totalBytesBefore)} → ${fileSize(totalBytesAfter)} (${percentageSaved}% smaller).`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
