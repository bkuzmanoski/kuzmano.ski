import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";

import { isVideo, posterImageStemOf, withoutExtension } from "../build/content/media/formats.ts";
import { fileSize } from "../build/content/media/problems.ts";
import { writeFileAtomically } from "../build/files.ts";

import { wholeNumberOption } from "./arguments.ts";
import { requireCommands, runCommand } from "./external-commands.ts";
import { inputFilePathsOf } from "./files.ts";

// Encodes videos as fast-start H.264 MP4s and writes matching poster images.

const DIRECTORY_VIDEO_EXTENSIONS = [".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"];
const DEFAULT_CRF = 23;
const DEFAULT_POSTER_SECONDS = 0;
const AUDIO_BITRATE = "128k";
const MP4_EXTENSION = ".mp4";
const POSTER_EXTENSION = ".png";

const USAGE = `Usage: node scripts/encode-video.ts [OPTIONS] <video|directory>...

Options:
  --crf <n>            Constant rate factor, 0-51; lower is larger (default: ${DEFAULT_CRF})
  --width <n>          Scale to this width, preserving the aspect ratio
  --poster-time <n>    Seconds into the video to take the poster from (default: ${DEFAULT_POSTER_SECONDS})
  -r, --recursive      Include videos in the subdirectories of a directory
  -h, --help           Show this message`;

interface EncodingOptions {
  crf: number;
  width: number | null;
  posterSeconds: number;
}

interface Arguments extends EncodingOptions {
  inputPaths: Array<string>;
  isRecursive: boolean;
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
    isRecursive: values.recursive ?? false,
    crf: wholeNumberOption("crf", values.crf, 51) ?? DEFAULT_CRF,
    width: wholeNumberOption("width", values.width) ?? null,
    posterSeconds: wholeNumberOption("poster-time", values["poster-time"]) ?? DEFAULT_POSTER_SECONDS,
  };
}

const mp4FilePathOf = (inputFilePath: string) =>
  isVideo(inputFilePath) ? inputFilePath : `${withoutExtension(inputFilePath)}${MP4_EXTENSION}`;
const posterImageFilePathOf = (videoFilePath: string) => `${posterImageStemOf(videoFilePath)}${POSTER_EXTENSION}`;
const sizeOf = async (filePath: string) => fileSize((await stat(filePath)).size);

async function encode(inputFilePath: string, mp4FilePath: string, { crf, width, posterSeconds }: EncodingOptions) {
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

  await runCommand("ffmpeg", [
    ...["-y", "-loglevel", "error", "-ss", String(posterSeconds), "-i", mp4FilePath],
    ...["-frames:v", "1", posterImageFilePath],
  ]);

  console.log(`  → ${posterImageFilePath}  ${await sizeOf(posterImageFilePath)}`);
}

try {
  const { inputPaths, isRecursive, ...encodingOptions } = parseArguments(process.argv.slice(2));
  const inputFilePaths = await inputFilePathsOf(inputPaths, {
    isRecursive,
    isIncludedDirectoryFile: (filePath) => DIRECTORY_VIDEO_EXTENSIONS.includes(extname(filePath).toLowerCase()),
  });

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
    await encode(inputFilePath, mp4FilePath, encodingOptions);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
