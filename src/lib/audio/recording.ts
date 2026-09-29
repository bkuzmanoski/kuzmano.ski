import { playBuffer } from "./buffer.ts";

const DECODE_SAMPLE_RATE = 44_100;

const decodedRecordings = new Map<string, AudioBuffer>();

export async function loadRecording(url: string): Promise<void> {
  if (decodedRecordings.has(url) || typeof OfflineAudioContext === "undefined") {
    return;
  }

  try {
    const response = await fetch(url);
    const encodedRecording = await response.arrayBuffer();
    const decodedRecording = await new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE).decodeAudioData(encodedRecording);

    decodedRecordings.set(url, decodedRecording);
  } catch {
    // Ignored.
  }
}

/** Plays the recording at `url` through the master gain, if loaded. */
export function playRecording(context: AudioContext, url: string, { at, level }: { at: number; level: number }) {
  const decodedRecording = decodedRecordings.get(url);

  if (decodedRecording) {
    playBuffer(context, decodedRecording, { at, level });
  }
}
