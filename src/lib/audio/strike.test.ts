import { describe, expect, test, vi } from "vitest";

import { fakeAudioContext } from "#/test-utils/audio.ts";

import { playBuffer } from "./buffer.ts";
import { playStrike } from "./strike.ts";

import type * as BufferModule from "./buffer.ts";
import type { Strike } from "./strike.ts";

vi.mock("./buffer.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BufferModule>()),
  playBuffer: vi.fn(),
}));

const strike = (overrides: Partial<Strike> = {}): Strike => ({
  durationSeconds: 0.01,
  attackSeconds: 0.0002,
  decaySeconds: 0.002,
  fadeSeconds: 0.002,
  seed: 0x5eed1e5,
  toneHz: 2000,
  toneQ: 1.2,
  dampingHz: 5000,
  ...overrides,
});

const bufferFor = (played: Strike) => {
  playStrike(fakeAudioContext(), played, { at: 0, level: 1, rate: 1 });
  return vi.mocked(playBuffer).mock.lastCall![1];
};

const samplesOf = (played: Strike) => Array.from(bufferFor(played).getChannelData(0));

describe("playStrike", () => {
  test("renders a buffer for the strike's full duration", () => {
    const buffer = bufferFor(strike({ durationSeconds: 0.02 }));
    expect(buffer.length / buffer.sampleRate).toBeCloseTo(0.02, 3);
  });

  test("renders the same noise burst for the same seed", () => {
    expect(samplesOf(strike())).toEqual(samplesOf(strike()));
  });

  test("renders a different noise burst for a different seed", () => {
    expect(samplesOf(strike({ seed: 1 }))).not.toEqual(samplesOf(strike({ seed: 2 })));
  });

  test("renders a strike once and plays that same buffer again", () => {
    const shared = strike();
    expect(bufferFor(shared)).toBe(bufferFor(shared));
  });

  test("uses separate buffers for two strikes with the same shape", () => {
    expect(bufferFor(strike())).not.toBe(bufferFor(strike()));
  });

  test("passes the schedule to playback unchanged", () => {
    playStrike(fakeAudioContext(), strike(), { at: 1.25, level: 0.4, rate: 0.92 });
    expect(vi.mocked(playBuffer).mock.lastCall![2]).toEqual({ at: 1.25, level: 0.4, rate: 0.92 });
  });
});
