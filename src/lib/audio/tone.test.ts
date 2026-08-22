import { describe, expect, test, vi } from "vitest";

import { fakeAudioContext } from "#/test-utils/audio";

import { playBuffer } from "./buffer";
import { playTone } from "./tone";

import type * as BufferModule from "./buffer";
import type { Tone } from "./tone";

vi.mock("./buffer", async (importOriginal) => ({
  ...(await importOriginal<typeof BufferModule>()),
  playBuffer: vi.fn(),
}));

const tone = (notes: Tone["notes"]): Tone => ({
  notes,
  partials: 2,
  partialDecay: 0.5,
  attackSeconds: 0.001,
  decaySeconds: 0.05,
  fadeSeconds: 0.005,
});

const bufferFor = (played: Tone) => {
  playTone(fakeAudioContext(), played, { at: 0, level: 1 });
  return vi.mocked(playBuffer).mock.lastCall![1];
};

describe("playTone", () => {
  test("renders a buffer for the combined duration of its notes", () => {
    const buffer = bufferFor(
      tone([
        { hz: 440, seconds: 0.1 },
        { hz: 660, seconds: 0.2 },
      ]),
    );
    expect(buffer.length / buffer.sampleRate).toBeCloseTo(0.3, 2);
  });

  test("renders a tone once and plays that same buffer again", () => {
    const shared = tone([{ hz: 440, seconds: 0.05 }]);
    expect(bufferFor(shared)).toBe(bufferFor(shared));
  });

  test("two tones with the same shape still use separate buffers", () => {
    expect(bufferFor(tone([{ hz: 440, seconds: 0.05 }]))).not.toBe(bufferFor(tone([{ hz: 440, seconds: 0.05 }])));
  });

  test("passes the schedule to playback unchanged", () => {
    playTone(fakeAudioContext(), tone([{ hz: 440, seconds: 0.05 }]), { at: 1.25, level: 0.4 });
    expect(vi.mocked(playBuffer).mock.lastCall![2]).toEqual({ at: 1.25, level: 0.4 });
  });
});
