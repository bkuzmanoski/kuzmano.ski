import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";

import { isVideo, posterImageStemOf } from "../build/content/media/formats.ts";
import { fileSize } from "../build/content/media/problems.ts";

import { wholeNumberOption } from "./arguments.ts";

// Encodes videos as fast-start H.264 MP4s and writes matching poster images.

const run = promisify(execFile);

const DEFAULT_CRF = 23;
const DEFAULT_POSTER_SECONDS = 0;
const AUDIO_BITRATE = "128k";
const POSTER_EXTENSION = ".png";

const USAGE = `Usage: node scripts/compress-video.ts [OPTIONS] <source> <destination.mp4>

Encodes <source> as an H.264 MP4 and writes its poster image beside the destination.

Options:
  --crf <n>            Constant rate factor, 0-51; lower is larger (default: ${DEFAULT_CRF})
  --width <n>          Scale to this width, preserving the aspect ratio
  --poster-time <n>    Seconds into the video to take the poster from (default: ${DEFAULT_POSTER_SECONDS})
  -h, --help           Show this message`;

interface Arguments {
  sourceFilePath: string;
  destinationFilePath: string;
  crf: number;
  width: number | null;
  posterSeconds: number;
}

function parseArguments(args: Array<string>): Arguments {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      crf: { type: "string" },
      width: { type: "string" },
      "poster-time": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return process.exit(0);
  }

  const [sourceFilePath, destinationFilePath] = positionals;

  if (positionals.length !== 2 || !sourceFilePath || !destinationFilePath) {
    throw new Error(USAGE);
  }

  if (!isVideo(destinationFilePath)) {
    throw new Error(`The destination must be an .mp4 file.`);
  }

  if (sourceFilePath === destinationFilePath) {
    throw new Error("The source and the destination are the same file.");
  }

  return {
    sourceFilePath,
    destinationFilePath,
    crf: wholeNumberOption("crf", values.crf, 51) ?? DEFAULT_CRF,
    width: wholeNumberOption("width", values.width) ?? null,
    posterSeconds: wholeNumberOption("poster-time", values["poster-time"]) ?? DEFAULT_POSTER_SECONDS,
  };
}

async function requireFfmpeg() {
  try {
    await run("ffmpeg", ["-version"]);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
      throw new Error("ffmpeg is not installed. Install it with `brew install ffmpeg`, then run this again.");
    }

    throw cause;
  }
}

const posterImageFilePathOf = (videoFilePath: string) => `${posterImageStemOf(videoFilePath)}${POSTER_EXTENSION}`;
const sizeOf = async (filePath: string) => fileSize((await stat(filePath)).size);

async function compress({ sourceFilePath, destinationFilePath, crf, width, posterSeconds }: Arguments) {
  await requireFfmpeg();
  await run("ffmpeg", [
    ...["-y", "-loglevel", "error", "-i", sourceFilePath],
    ...["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p"],
    ...["-crf", String(crf), "-preset", "slow", "-movflags", "+faststart"],
    ...["-vf", `${width === null ? "scale=trunc(iw/2)*2:trunc(ih/2)*2" : `scale=${width}:-2`},setsar=1`], // Ensure even dimensions for `yuv420p` and square pixels so posters match the video's display aspect ratio.
    ...["-c:a", "aac", "-b:a", AUDIO_BITRATE],
    destinationFilePath,
  ]);

  console.log(`${destinationFilePath}  ${await sizeOf(destinationFilePath)}`);

  const posterImageFilePath = posterImageFilePathOf(destinationFilePath);

  await run("ffmpeg", [
    ...["-y", "-loglevel", "error", "-ss", String(posterSeconds), "-i", destinationFilePath],
    ...["-frames:v", "1", posterImageFilePath],
  ]);

  console.log(`${posterImageFilePath} (${await sizeOf(posterImageFilePath)})`);
}

try {
  await compress(parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
