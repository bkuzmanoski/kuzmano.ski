import { bufferCache, playBuffer, renderBuffer } from "./buffer";
import { DRIVER_SAMPLE_RATE, quantizeToDriver } from "./driver";

export interface Note {
  hz: number;
  seconds: number;
}

/**
 * A pitched sound: a short run of notes played end to end, each one an odd-harmonic stack
 * shaped like a square wave after its higher partials have rolled off, approximating the
 * sound of the Macintosh driver. Rendered through the driver's own sample rate and quantizer.
 */
export interface Tone {
  notes: ReadonlyArray<Note>;
  partials: number; // Odd harmonics only.
  partialDecay: number;
  attackSeconds: number; // Applied per note, so a step up in pitch does not click.
  decaySeconds: number;
  fadeSeconds: number;
}

const toneSeconds = (tone: Tone) => tone.notes.reduce((total, note) => total + note.seconds, 0);

// The note sounding at `seconds`, with the time elapsed within it. The last note absorbs
// any rounding past the end of the run so the final samples still have a pitch to render.
function noteAt(tone: Tone, seconds: number): { note: Note; elapsed: number } {
  let start = 0;

  for (const note of tone.notes) {
    if (seconds < start + note.seconds) {
      return { note, elapsed: seconds - start };
    }

    start += note.seconds;
  }

  const last = tone.notes.at(-1)!;

  return { note: last, elapsed: last.seconds };
}

const sampleFor = bufferCache((context: AudioContext, tone: Tone) =>
  renderBuffer(context, {
    sampleRate: DRIVER_SAMPLE_RATE,
    durationSeconds: toneSeconds(tone),
    attackSeconds: tone.attackSeconds,
    fadeSeconds: tone.fadeSeconds,
    sample: (_, seconds) => {
      const { note, elapsed } = noteAt(tone, seconds);
      const attack = Math.min(1, elapsed / tone.attackSeconds);

      let value = 0;

      for (let partial = 0; partial < tone.partials; partial++) {
        const harmonic = 2 * partial + 1;
        const decaySeconds = tone.decaySeconds * Math.pow(tone.partialDecay, partial);
        const amplitude = Math.exp(-elapsed / decaySeconds) / harmonic;

        value += amplitude * Math.sin(2 * Math.PI * note.hz * harmonic * elapsed);
      }

      return value * attack;
    },
    quantize: quantizeToDriver,
  }),
);

/** Plays `tone` through the master gain. Every `Tone` must be a module constant; see `bufferCache`. */
export function playTone(context: AudioContext, tone: Tone, { at, level }: { at: number; level: number }) {
  playBuffer(context, sampleFor(context, tone), { at, level });
}
