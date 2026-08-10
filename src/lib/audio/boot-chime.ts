import { LEAD_TIME, playSound } from "./context";
import { playBuffer, renderBuffer } from "./voice";

const SAMPLE_RATE = 22254.54; // The sample rate the Macintosh 128K sound driver used, in Hz.
const QUANTIZATION_STEPS = 127; // Eight bits, signed, across the full swing of the cone.

const CHIME = {
  seconds: 1.2,
  level: 0.5,
  fundamentalHz: 440,
  partials: 6, // Odd harmonics only.
  partialDecay: 0.5,
  attackSeconds: 0.004,
  decaySeconds: 0.55,
  fadeSeconds: 0.06,
};

let chimeBuffer: AudioBuffer | null = null;

function chimeSample(context: AudioContext): AudioBuffer {
  chimeBuffer ??= renderBuffer(context, {
    sampleRate: SAMPLE_RATE,
    seconds: CHIME.seconds,
    attackSeconds: CHIME.attackSeconds,
    fadeSeconds: CHIME.fadeSeconds,
    sample: (_, seconds) => {
      let value = 0;

      for (let partial = 0; partial < CHIME.partials; partial++) {
        const harmonic = 2 * partial + 1;
        const decaySeconds = CHIME.decaySeconds * Math.pow(CHIME.partialDecay, partial);
        const amplitude = Math.exp(-seconds / decaySeconds) / harmonic;

        value += amplitude * Math.sin(2 * Math.PI * CHIME.fundamentalHz * harmonic * seconds);
      }

      return value;
    },
    quantize: (value) => Math.round(value * QUANTIZATION_STEPS) / QUANTIZATION_STEPS,
  });

  return chimeBuffer;
}

export function playBootChime({ delaySeconds }: { delaySeconds: number }) {
  playSound((context) => {
    playBuffer(context, chimeSample(context), {
      at: context.currentTime + LEAD_TIME + delaySeconds,
      level: CHIME.level,
    });
  });
}
