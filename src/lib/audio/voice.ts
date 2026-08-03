import { getGainNode } from "./context";

/**
 * A struck object: a burst of noise shaped by the resonance
 * it rang and the damping that suppressed it.
 */
export interface Voice {
  seconds: number; // From the strike to silence.
  seed: number;
  toneHz: number;
  toneQ: number;
  dampingHz: number;
  attackSeconds: number;
  decaySeconds: number;
  fadeSeconds: number;
}

const voiceBuffers = new Map<Voice, AudioBuffer>();

/** A seedable PRNG for deterministic voice rendering. */
export function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleFor(context: AudioContext, voice: Voice): AudioBuffer {
  const cachedBuffer = voiceBuffers.get(voice);

  if (cachedBuffer) {
    return cachedBuffer;
  }

  const rate = context.sampleRate;
  const length = Math.max(1, Math.round(rate * voice.seconds));
  const buffer = context.createBuffer(1, length, rate);
  const samples = buffer.getChannelData(0);
  const random = mulberry32(voice.seed);

  // A bandpass biquad (RBJ cookbook, constant 0dB peak gain). `b1` is 0 here.
  const w0 = (2 * Math.PI * voice.toneHz) / rate;
  const alpha = Math.sin(w0) / (2 * voice.toneQ);
  const scale = 1 + alpha;
  const b0 = alpha / scale;
  const b2 = -alpha / scale;
  const a1 = (-2 * Math.cos(w0)) / scale;
  const a2 = (1 - alpha) / scale;

  const damping = 1 - Math.exp((-2 * Math.PI * voice.dampingHz) / rate); // A one-pole lowpass.
  const attack = Math.max(1, rate * voice.attackSeconds);
  const fade = Math.max(1, rate * voice.fadeSeconds);

  const renderedSamples: Array<number> = [];

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let damped = 0;
  let peak = 0;

  for (let i = 0; i < length; i++) {
    const x = random() * 2 - 1;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;

    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    damped += damping * (y - damped);

    const strike = Math.min(1, (i + 1) / attack);
    const decay = Math.exp(-(i / rate) / voice.decaySeconds);
    const tail = Math.min(1, (length - 1 - i) / fade);
    const sample = damped * strike * decay * tail;

    renderedSamples.push(sample);
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalizedAmplitude = peak > 0 ? 1 / peak : 0;

  samples.set(renderedSamples.map((sample) => sample * normalizedAmplitude));
  voiceBuffers.set(voice, buffer);

  return buffer;
}

export function playVoice(
  context: AudioContext,
  voice: Voice,
  { at, level, rate }: { at: number; level: number; rate: number },
) {
  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = sampleFor(context, voice);
  source.playbackRate.value = rate;
  gain.gain.value = level;

  source.connect(gain);
  gain.connect(getGainNode(context));

  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };

  source.start(at);
}
