import { describe, expect, test } from "vitest";

import { renderBuffer } from "./voice";

/* jsdom has no AudioContext; `renderBuffer` only needs `createBuffer`. */
function fakeContext(): AudioContext {
  return {
    createBuffer(_channels: number, length: number, sampleRate: number) {
      const data = new Float32Array(length);
      return { length, sampleRate, getChannelData: () => data };
    },
  } as unknown as AudioContext;
}

const read = (buffer: AudioBuffer) => Array.from(buffer.getChannelData(0));

describe("renderBuffer", () => {
  test("normalizes the kernel's output to a peak of 1", () => {
    const buffer = renderBuffer(fakeContext(), {
      sampleRate: 100,
      seconds: 0.1,
      attackSeconds: 0,
      fadeSeconds: 0,
      sample: () => 0.25,
    });

    expect(Math.max(...read(buffer).map(Math.abs))).toBeCloseTo(1);
  });

  test("shapes the edges with the attack and fade envelope", () => {
    const samples = read(
      renderBuffer(fakeContext(), {
        sampleRate: 100,
        seconds: 0.1,
        attackSeconds: 0.05,
        fadeSeconds: 0.05,
        sample: () => 1,
      }),
    );

    expect(samples[0]!).toBeLessThan(samples[4]!);
    expect(samples.at(-1)!).toBe(0);
    expect(samples.at(-2)!).toBeLessThan(samples[4]!);
  });

  test("quantize coarsens each sample after normalization", () => {
    const samples = read(
      renderBuffer(fakeContext(), {
        sampleRate: 100,
        seconds: 0.1,
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

  test("a silent kernel stays silent instead of dividing by zero", () => {
    const samples = read(
      renderBuffer(fakeContext(), {
        sampleRate: 100,
        seconds: 0.1,
        attackSeconds: 0,
        fadeSeconds: 0,
        sample: () => 0,
      }),
    );

    expect(samples.every((sample) => sample === 0)).toBe(true);
  });
});
