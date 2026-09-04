import { getGainNode } from "./context.ts";

/**
 * Renders a mono buffer from `sample`, the kernel that produces the raw signal.
 * Applies the shared attack and fade envelope and normalizes the peak to 1 before
 * `quantize`, if given, coarsens the samples.
 */
export function renderBuffer(
  context: AudioContext,
  {
    sampleRate,
    durationSeconds,
    attackSeconds,
    fadeSeconds,
    sample,
    quantize,
  }: {
    sampleRate: number;
    durationSeconds: number;
    attackSeconds: number;
    fadeSeconds: number;
    sample: (index: number, seconds: number) => number;
    quantize?: (value: number) => number;
  },
): AudioBuffer {
  const length = Math.max(1, Math.round(sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, sampleRate);
  const samples = buffer.getChannelData(0);
  const attackSamples = Math.max(1, sampleRate * attackSeconds);
  const fadeSamples = Math.max(1, sampleRate * fadeSeconds);

  let peak = 0;

  for (let i = 0; i < length; i++) {
    const attack = Math.min(1, (i + 1) / attackSamples);
    const fade = Math.min(1, (length - 1 - i) / fadeSamples);
    const value = sample(i, i / sampleRate) * attack * fade;

    samples[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  const normalizedAmplitude = peak > 0 ? 1 / peak : 0;
  const finalize = quantize ?? ((value: number) => value);

  for (let i = 0; i < length; i++) {
    samples[i] = finalize(samples[i]! * normalizedAmplitude);
  }

  return buffer;
}

/** Plays a rendered buffer through the master gain and tears down the node graph when it ends. */
export function playBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  { at, level, rate = 1 }: { at: number; level: number; rate?: number },
) {
  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
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

/**
 * Caches each rendered spec and replays its buffer on subsequent plays.
 *
 * Specs are keyed by identity, so they must be module-level constants; a new spec at the call
 * site would render again on every play. Buffers are also tied to the audio context they were
 * rendered with, which is stable for the session.
 */
export function bufferCache<TSpec extends object>(render: (context: AudioContext, spec: TSpec) => AudioBuffer) {
  const buffers = new Map<TSpec, AudioBuffer>();

  return (context: AudioContext, spec: TSpec): AudioBuffer => {
    let buffer = buffers.get(spec);

    if (!buffer) {
      buffer = render(context, spec);
      buffers.set(spec, buffer);
    }

    return buffer;
  };
}
