import { LEAD_TIME, getGainNode, playSound } from "./context";

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
