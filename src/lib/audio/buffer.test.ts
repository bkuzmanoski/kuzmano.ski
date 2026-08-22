import { describe, expect, test, vi } from "vitest";

import { fakeAudioContext } from "#/test-utils/audio";

import { bufferCache, renderBuffer } from "./buffer";

const read = (buffer: AudioBuffer) => Array.from(buffer.getChannelData(0));

describe("renderBuffer", () => {
  test("normalizes the kernel output to a peak of 1", () => {
    const buffer = renderBuffer(fakeAudioContext(), {
      sampleRate: 100,
      durationSeconds: 0.1,
      attackSeconds: 0,
      fadeSeconds: 0,
      sample: () => 0.25,
    });
    expect(Math.max(...read(buffer).map(Math.abs))).toBeCloseTo(1);
  });

  test("applies the attack and fade envelopes to the signal edges", () => {
    const samples = read(
      renderBuffer(fakeAudioContext(), {
        sampleRate: 100,
        durationSeconds: 0.1,
        attackSeconds: 0.05,
        fadeSeconds: 0.05,
        sample: () => 1,
      }),
    );

    expect(samples[0]!).toBeLessThan(samples[4]!);
    expect(samples.at(-1)!).toBe(0);
    expect(samples.at(-2)!).toBeLessThan(samples[4]!);
  });

  test("applies quantization after normalization", () => {
    const samples = read(
      renderBuffer(fakeAudioContext(), {
        sampleRate: 100,
        durationSeconds: 0.1,
        attackSeconds: 0,
        fadeSeconds: 0,
        sample: (index) => (index % 3) / 3,
        quantize: (value) => Math.round(value * 2) / 2,
      }),
    );

    for (const sample of samples) {
      expect([0, 0.5, 1]).toContain(sample);
    }
  });

  test("keeps a silent kernel silent", () => {
    const samples = read(
      renderBuffer(fakeAudioContext(), {
        sampleRate: 100,
        durationSeconds: 0.1,
        attackSeconds: 0,
        fadeSeconds: 0,
        sample: () => 0,
      }),
    );
    expect(samples.every((sample) => sample === 0)).toBe(true);
  });
});

describe("bufferCache", () => {
  const cached = () => {
    const render = vi.fn((context: AudioContext, spec: { hz: number }) =>
      renderBuffer(context, {
        sampleRate: 100,
        durationSeconds: 0.01,
        attackSeconds: 0,
        fadeSeconds: 0,
        sample: () => spec.hz,
      }),
    );
    return { render, sampleFor: bufferCache(render) };
  };

  test("renders each spec once and returns the cached buffer", () => {
    const { render, sampleFor } = cached();
    const spec = { hz: 440 };
    const context = fakeAudioContext();

    expect(sampleFor(context, spec)).toBe(sampleFor(context, spec));
    expect(render).toHaveBeenCalledOnce();
  });

  test("caches specs by identity rather than value", () => {
    const { render, sampleFor } = cached();
    const context = fakeAudioContext();

    expect(sampleFor(context, { hz: 440 })).not.toBe(sampleFor(context, { hz: 440 }));
    expect(render).toHaveBeenCalledTimes(2);
  });
});
