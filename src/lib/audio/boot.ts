import { LEAD_TIME, getGainNode, playSound } from "./context";
import { mulberry32, playVoice } from "./voice";

import type { Voice } from "./voice";

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
  if (chimeBuffer) {
    return chimeBuffer;
  }

  const length = Math.max(1, Math.round(SAMPLE_RATE * CHIME.seconds));
  const buffer = context.createBuffer(1, length, SAMPLE_RATE);
  const samples = buffer.getChannelData(0);
  const attack = Math.max(1, SAMPLE_RATE * CHIME.attackSeconds);
  const fade = Math.max(1, SAMPLE_RATE * CHIME.fadeSeconds);

  const renderedSamples: Array<number> = [];

  let peak = 0;

  for (let i = 0; i < length; i++) {
    const seconds = i / SAMPLE_RATE;

    let value = 0;

    for (let partial = 0; partial < CHIME.partials; partial++) {
      const harmonic = 2 * partial + 1;
      const decaySeconds = CHIME.decaySeconds * Math.pow(CHIME.partialDecay, partial);
      const amplitude = Math.exp(-seconds / decaySeconds) / harmonic;

      value += amplitude * Math.sin(2 * Math.PI * CHIME.fundamentalHz * harmonic * seconds);
    }

    const strike = Math.min(1, (i + 1) / attack);
    const tail = Math.min(1, (length - 1 - i) / fade);
    const sample = value * strike * tail;

    renderedSamples.push(sample);
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalizedAmplitude = peak > 0 ? 1 / peak : 0;

  samples.set(
    renderedSamples.map((sample) => Math.round(sample * normalizedAmplitude * QUANTIZATION_STEPS) / QUANTIZATION_STEPS),
  );
  chimeBuffer = buffer;

  return buffer;
}

export function playBootChime({ delaySeconds }: { delaySeconds: number }) {
  playSound((context) => {
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = chimeSample(context);
    gain.gain.value = CHIME.level;

    source.connect(gain);
    gain.connect(getGainNode(context));

    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    source.start(context.currentTime + LEAD_TIME + delaySeconds);
  });
}

// TODO: Adjust variables for a more realistic sound.
const SEEK: Voice = {
  seconds: 0.06,
  seed: 0x0d15c5,
  toneHz: 820,
  toneQ: 0.8,
  dampingHz: 2400,
  attackSeconds: 0.0004,
  decaySeconds: 0.014,
  fadeSeconds: 0.006,
};

const DRIVE_LOOP_SECONDS = 2;

/* The stretches over which the drive light is lit, as fractions of its loop. Kept
 * in step with the `disk-activity` keyframes in `ui/boot-sequence.module.css`, so
 * the head is heard moving exactly while the light says it is moving. */
const DRIVE_BURSTS = [
  [0, 0.07],
  [0.12, 0.16],
  [0.2, 0.31],
  [0.35, 0.38],
  [0.47, 0.51],
  [0.55, 0.66],
  [0.73, 0.77],
  [0.81, 0.88],
] as const;

const STEP_SECONDS = 0.028; // How long the head takes to move a track and settle.
const STEP_LEVEL = { quiet: 0.22, loud: 0.34 };
const STEP_RATE = { slow: 0.92, fast: 1.08 };
const STEP_SEED = 0x5eeca11;

/**
 * The disk drive working, starting `delaySeconds` from now and running for `seconds`.
 * The whole run is scheduled in one go: the caller knows how long the drive should
 * be busy, and Web Audio's clock keeps the steps even where a timer would drift
 * against the light.
 */
export function playDiskActivity({ delaySeconds, seconds }: { delaySeconds: number; seconds: number }) {
  playSound((context) => {
    const start = context.currentTime + LEAD_TIME + delaySeconds;
    const end = start + seconds;
    const random = mulberry32(STEP_SEED);

    for (let loop = 0; start + loop * DRIVE_LOOP_SECONDS < end; loop++) {
      const loopStart = start + loop * DRIVE_LOOP_SECONDS;

      for (const [from, to] of DRIVE_BURSTS) {
        const burstEnd = Math.min(loopStart + to * DRIVE_LOOP_SECONDS, end);

        for (let at = loopStart + from * DRIVE_LOOP_SECONDS; at < burstEnd; at += STEP_SECONDS) {
          const variation = random(); // Avoid a metronomic sound by varying the level and rate of each step within a range.
          playVoice(context, SEEK, {
            at,
            level: STEP_LEVEL.quiet + (STEP_LEVEL.loud - STEP_LEVEL.quiet) * variation,
            rate: STEP_RATE.slow + (STEP_RATE.fast - STEP_RATE.slow) * variation,
          });
        }
      }
    }
  });
}
