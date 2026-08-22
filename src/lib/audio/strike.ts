import { bufferCache, playBuffer, renderBuffer } from "./buffer";

/* A struck object: a burst of noise shaped by its resonance and the damping that suppresses it. */
export interface Strike {
  durationSeconds: number;
  attackSeconds: number;
  decaySeconds: number;
  fadeSeconds: number;
  seed: number;
  toneHz: number;
  toneQ: number;
  dampingHz: number;
}

// Seedable PRNG, so a strike renders the same noise burst every time.
function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sampleFor = bufferCache((context: AudioContext, strike: Strike) => {
  const rate = context.sampleRate;
  const random = mulberry32(strike.seed);

  // A bandpass biquad (RBJ cookbook, constant 0dB peak gain). `b1` is 0 here.
  const w0 = (2 * Math.PI * strike.toneHz) / rate;
  const alpha = Math.sin(w0) / (2 * strike.toneQ);
  const scale = 1 + alpha;
  const b0 = alpha / scale;
  const b2 = -alpha / scale;
  const a1 = (-2 * Math.cos(w0)) / scale;
  const a2 = (1 - alpha) / scale;

  const damping = 1 - Math.exp((-2 * Math.PI * strike.dampingHz) / rate); // A one-pole lowpass.

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let damped = 0;

  return renderBuffer(context, {
    sampleRate: rate,
    durationSeconds: strike.durationSeconds,
    attackSeconds: strike.attackSeconds,
    fadeSeconds: strike.fadeSeconds,
    sample: (_, seconds) => {
      const x = random() * 2 - 1;
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;

      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      damped += damping * (y - damped);

      return damped * Math.exp(-seconds / strike.decaySeconds);
    },
  });
});

export function playStrike(
  context: AudioContext,
  strike: Strike,
  { at, level, rate }: { at: number; level: number; rate: number },
) {
  playBuffer(context, sampleFor(context, strike), { at, level, rate });
}
