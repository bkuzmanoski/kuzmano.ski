import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";

import { errorMessageOf } from "#/lib/errors.ts";

import { isVideo, posterImageStemOf, withoutExtension } from "../build/content/media/formats.ts";
import { fileSize, videoProblems } from "../build/content/media/problems.ts";
import { mp4MetadataIn } from "../build/content/media/resolved-media.ts";
import { writeFileAtomically } from "../build/files.ts";

import { wholeNumberOption } from "./helpers/arguments.ts";
import { requireCommands, runCommand } from "./helpers/external-commands.ts";
import { changeToInvocationDirectory, inputFilePathsOf } from "./helpers/files.ts";

// Encodes videos as fast-start H.264 MP4s and writes matching poster images.

const DIRECTORY_VIDEO_EXTENSIONS = [".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"];
const DEFAULT_CRF = 23;
const DEFAULT_POSTER_TIME_S = 0;
const AUDIO_BITRATE = "128k";
const MP4_EXTENSION = ".mp4";
const POSTER_EXTENSION = ".png";

const USAGE = `Usage: node scripts/encode-video.ts [OPTIONS] <video|directory>...

Options:
  --crf <n>          Constant rate factor, 0-51; lower is larger (default: ${DEFAULT_CRF})
  --width <n>        Scale to this width, preserving the aspect ratio
  --poster-time <n>  Seconds into the video to take the poster from (default: ${DEFAULT_POSTER_TIME_S})
  -r, --recursive    Include videos in the subdirectories of a directory
  -f, --force        Encode an MP4 that already has a poster image and passes the build's checks
  -h, --help         Show this message`;

interface EncodingOptions {
  crf: number;
  width: number | null;
  posterTimeSeconds: number;
}

interface Arguments extends EncodingOptions {
  inputPaths: Array<string>;
  isRecursive: boolean;
  isForced: boolean;
  /** Whether the command sets `--crf`, `--width`, or `--poster-time`. */
  hasEncodingOptions: boolean;
}

function parseArguments(args: Array<string>): Arguments {
  const { values, positionals: inputPaths } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      crf: { type: "string" },
      width: { type: "string" },
      "poster-time": { type: "string" },
      recursive: { type: "boolean", short: "r" },
      force: { type: "boolean", short: "f" },
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

  const width = wholeNumberOption("width", values.width) ?? null;

  if (width !== null && (width === 0 || width % 2 !== 0)) {
    throw new Error("--width must be a positive even number (H.264 with yuv420p requires even dimensions).");
  }

  return {
    inputPaths,
    isRecursive: values.recursive ?? false,
    isForced: values.force ?? false,
    hasEncodingOptions: [values.crf, values.width, values["poster-time"]].some((value) => value !== undefined),
    crf: wholeNumberOption("crf", values.crf, 51) ?? DEFAULT_CRF,
    width,
    posterTimeSeconds: wholeNumberOption("poster-time", values["poster-time"]) ?? DEFAULT_POSTER_TIME_S,
  };
}

const mp4FilePathOf = (inputFilePath: string) =>
  isVideo(inputFilePath) ? inputFilePath : `${withoutExtension(inputFilePath)}${MP4_EXTENSION}`;
const posterImageFilePathOf = (videoFilePath: string) => `${posterImageStemOf(videoFilePath)}${POSTER_EXTENSION}`;
const sizeOf = async (filePath: string) => fileSize((await stat(filePath)).size);

/**
 * Whether `mp4FilePath` is an earlier output of this script (i.e., an MP4 with a poster image that passes the build's
 * checks).
 */
async function isAlreadyEncoded(mp4FilePath: string): Promise<boolean> {
  if (!existsSync(mp4FilePath) || !existsSync(posterImageFilePathOf(mp4FilePath))) {
    return false;
  }

  const contents = await readFile(mp4FilePath);

  return (
    videoProblems({ path: mp4FilePath, bytes: contents.byteLength, mp4Metadata: mp4MetadataIn(contents) }).length === 0
  );
}

async function encode(inputFilePath: string, mp4FilePath: string, { crf, width, posterTimeSeconds }: EncodingOptions) {
  console.log(`${inputFilePath} (${await sizeOf(inputFilePath)})`);

  await writeFileAtomically(mp4FilePath, (temporaryFilePath) =>
    runCommand("ffmpeg", [
      ...["-y", "-loglevel", "error", "-i", inputFilePath],
      ...["-map_metadata", "-1", "-map_chapters", "-1"], // Strips metadata such as the recording location. ffmpeg applies a rotation tag to the frames.
      ...["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p"],
      ...["-crf", String(crf), "-preset", "slow", "-movflags", "+faststart"],
      ...["-vf", `${width === null ? "scale=trunc(iw/2)*2:trunc(ih/2)*2" : `scale=${width}:-2`},setsar=1`], // Ensure even dimensions for `yuv420p` and square pixels so posters match the video's display aspect ratio.
      ...["-c:a", "aac", "-b:a", AUDIO_BITRATE],
      ...["-f", "mp4", temporaryFilePath], // The `.tmp` extension does not identify a container format.
    ]),
  );

  console.log(`  → ${mp4FilePath}  ${await sizeOf(mp4FilePath)}`);

  const posterImageFilePath = posterImageFilePathOf(mp4FilePath);

  await writeFileAtomically(posterImageFilePath, (temporaryFilePath) =>
    runCommand("ffmpeg", [
      ...["-y", "-loglevel", "error", "-ss", String(posterTimeSeconds), "-i", mp4FilePath],
      ...["-frames:v", "1", "-update", "1", "-f", "image2", "-c:v", "png", temporaryFilePath], // The `.tmp` extension does not identify an image format.
    ]),
  );

  console.log(`  → ${posterImageFilePath}  ${await sizeOf(posterImageFilePath)}`);
}

try {
  changeToInvocationDirectory();

  const { inputPaths, isRecursive, isForced, hasEncodingOptions, ...encodingOptions } = parseArguments(
    process.argv.slice(2),
  );
  const listedFilePaths = await inputFilePathsOf(inputPaths, {
    isRecursive,
    isIncludedDirectoryFile: (filePath) => DIRECTORY_VIDEO_EXTENSIONS.includes(extname(filePath).toLowerCase()),
  });
  const outputsOfOtherInputs = new Set(listedFilePaths.filter((filePath) => !isVideo(filePath)).map(mp4FilePathOf));
  const inputFilePaths = listedFilePaths.filter((filePath) => !outputsOfOtherInputs.has(filePath)); // An MP4 beside its source is that source's output, which encoding the source replaces.

  if (inputFilePaths.length === 0) {
    throw new Error("No videos were found.");
  }

  // Checked before any video is encoded, as encoding the second input would overwrite or re-encode the first's MP4.
  const inputFilePathsByMp4FilePath = new Map<string, string>();

  for (const inputFilePath of inputFilePaths) {
    const mp4FilePath = mp4FilePathOf(inputFilePath);
    const otherInputFilePath = inputFilePathsByMp4FilePath.get(mp4FilePath);

    if (otherInputFilePath !== undefined) {
      throw new Error(`${otherInputFilePath} and ${inputFilePath} would both be encoded to ${mp4FilePath}.`);
    }

    inputFilePathsByMp4FilePath.set(mp4FilePath, inputFilePath);
  }

  await requireCommands("ffmpeg");

  for (const [mp4FilePath, inputFilePath] of inputFilePathsByMp4FilePath) {
    const isEncodedFromSource = hasEncodingOptions && inputFilePath !== mp4FilePath;

    if (!isForced && !isEncodedFromSource && (await isAlreadyEncoded(mp4FilePath))) {
      console.log(`${inputFilePath}: ${mp4FilePath} has already been encoded. Use --force to encode it again.`);
      continue;
    }

    await encode(inputFilePath, mp4FilePath, encodingOptions);
  }
} catch (error) {
  console.error(errorMessageOf(error));
  process.exit(1);
}
