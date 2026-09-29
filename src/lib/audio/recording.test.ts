import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeAudioContext } from "#/test-utils/audio.ts";

import { playBuffer } from "./buffer.ts";
import { loadRecording, playRecording } from "./recording.ts";

import type * as BufferModule from "./buffer.ts";

vi.mock("./buffer.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BufferModule>()),
  playBuffer: vi.fn(),
}));

const decodedRecording = { id: "decoded recording" } as unknown as AudioBuffer;
const decodeAudioData = vi.fn();

beforeEach(() => {
  vi.mocked(playBuffer).mockClear();
  decodeAudioData.mockReset().mockResolvedValue(decodedRecording);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData = decodeAudioData;
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("loadRecording", () => {
  test("fetches and decodes a recording once across repeated loads of its URL", async () => {
    await loadRecording("/sounds/sound.wav");
    await loadRecording("/sounds/sound.wav");

    expect(fetch).toHaveBeenCalledOnce();
    expect(decodeAudioData).toHaveBeenCalledOnce();
  });

  test("resolves rather than rejecting when the recording fails to decode", async () => {
    decodeAudioData.mockRejectedValue(new Error("Unable to decode audio data"));
    await expect(loadRecording("/sounds/undecodable.wav")).resolves.toBeUndefined();
  });

  test("resolves without fetching the recording when `OfflineAudioContext` is unavailable", async () => {
    vi.stubGlobal("OfflineAudioContext", undefined);
    await loadRecording("/sounds/unsupported.wav");

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("playRecording", () => {
  test("plays a loaded recording at the given `at` time and `level`", async () => {
    await loadRecording("/sounds/loaded.wav");
    playRecording(fakeAudioContext(), "/sounds/loaded.wav", { at: 1.25, level: 0.4 });

    expect(vi.mocked(playBuffer).mock.lastCall!.slice(1)).toEqual([decodedRecording, { at: 1.25, level: 0.4 }]);
  });

  test("does not play a recording before it loads", () => {
    playRecording(fakeAudioContext(), "/sounds/not-loaded.wav", { at: 0, level: 1 });
    expect(playBuffer).not.toHaveBeenCalled();
  });

  test("does not play a recording that failed to decode", async () => {
    decodeAudioData.mockRejectedValue(new Error("Unable to decode audio data"));
    await loadRecording("/sounds/undecodable.wav");
    playRecording(fakeAudioContext(), "/sounds/undecodable.wav", { at: 0, level: 1 });

    expect(playBuffer).not.toHaveBeenCalled();
  });
});
