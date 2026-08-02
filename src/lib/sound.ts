import { useEffect } from "react";

import { getSettings } from "./settings";

/* Web Audio runs on its own thread and renders ahead of `currentTime`, so anything
 * scheduled at `currentTime` is partly in the past by the time it is rendered. */
const LEAD_TIME = 0.02;
const OUTPUT_GAIN = 0.2;

let audioContext: AudioContext | null = null;
let output: GainNode | null = null;
let unlocking: Promise<void> | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  const Constructor = typeof window === "undefined" ? undefined : window.AudioContext;

  if (!Constructor) {
    return null;
  }

  audioContext = new Constructor({ latencyHint: "interactive" });

  return audioContext;
}

function configureAudioOutput(context: AudioContext): GainNode {
  if (!output) {
    output = context.createGain();
    output.gain.value = OUTPUT_GAIN;
    output.connect(context.destination);
  }

  return output;
}

function unlockAudio(): void {
  const context = getAudioContext();

  if (!context || context.state === "running" || unlocking) {
    return;
  }

  unlocking = context
    .resume()
    .catch(() => {
      /* Ignored. */
    })
    .finally(() => {
      unlocking = null;
    });
}

export function useAudioUnlock() {
  useEffect(() => {
    function unlock() {
      if (getSettings().sound !== "on") {
        return;
      }

      unlockAudio();
    }

    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("keydown", unlock, { capture: true, passive: true });
    document.addEventListener("visibilitychange", unlock);

    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", unlock);
    };
  }, []);
}

/**
 * If the context is already running (once `unlockAudio` has fired once this
 * session) this is synchronous. If it isn't—e.g. this is the very first
 * interaction—it falls back to resuming inline, which only works if this
 * call is inside a trusted user gesture.
 */
function playSound(play: (context: AudioContext) => void) {
  if (getSettings().sound !== "on") {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "running") {
    play(context);
    return;
  }

  void context
    .resume()
    .then(() => play(context))
    .catch(() => {
      /* Ignored. */
    });
}

interface Voice {
  seconds: number; // From the strike to silence.
  seed: number;
  toneHz: number;
  toneQ: number;
  dampingHz: number;
  attackSeconds: number;
  decaySeconds: number;
  fadeSeconds: number;
}

const CLICK: Voice = {
  seconds: 0.015,
  seed: 0x5eed1e5,
  toneHz: 2000,
  toneQ: 1.2,
  dampingHz: 5000,
  attackSeconds: 0.0002,
  decaySeconds: 0.002,
  fadeSeconds: 0.002,
};

const DETENT: Voice = {
  seconds: 0.01,
  seed: 0x0de7e47,
  toneHz: 3000,
  toneQ: 1.6,
  dampingHz: 7000,
  attackSeconds: 0.0001,
  decaySeconds: 0.001,
  fadeSeconds: 0.0015,
};

const voiceBuffers = new Map<Voice, AudioBuffer>();

function mulberry32(seed: number): () => number {
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

  // A one-pole lowpass over the top of it.
  const damping = 1 - Math.exp((-2 * Math.PI * voice.dampingHz) / rate);

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

function playVoice(
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
  gain.connect(configureAudioOutput(context));

  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };

  source.start(at);
}

let lastClickAt = 0;

/** The mouse button, going down. */
export function playClick() {
  playSound((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME, lastClickAt + CLICK.seconds);

    playVoice(context, CLICK, { at, level: 1, rate: 1 });
    lastClickAt = at;
  });
}

const DETENT_PIXELS = 24; // How far the content moves between detents.
const DETENT_FULL_SPEED = 2200; // The speed, in pixels per second, at which a detent is at full strength.
const DETENT_LEVEL = { quiet: 0.3, loud: 0.6 };
const DETENT_RATE = { slow: 0.9, fast: 1.1 };
const DETENT_INTERVAL = 0.01;
const DETENT_IDLE_MS = 250;
const DETENT_SPEED_SMOOTHING = 0.5;

let lastDetentAt = 0;

function playDetent(speed: number) {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastDetentAt + DETENT_INTERVAL) {
      return;
    }

    const intensity = Math.sqrt(Math.min(1, speed / DETENT_FULL_SPEED));

    playVoice(context, DETENT, {
      at,
      level: DETENT_LEVEL.quiet + (DETENT_LEVEL.loud - DETENT_LEVEL.quiet) * intensity,
      rate: DETENT_RATE.slow + (DETENT_RATE.fast - DETENT_RATE.slow) * intensity,
    });

    lastDetentAt = at;
  });
}

interface ScrollGesture {
  top: number;
  at: number;
  speed: number;
  distance: number;
}

const gestures = new WeakMap<Element, ScrollGesture>(); // Per element, so two windows scrolling at once each keep their own place.

export function playScroll(element: Element) {
  const now = performance.now();
  const top = element.scrollTop;
  const gesture = gestures.get(element);

  if (!gesture) {
    gestures.set(element, { top, at: now, speed: 0, distance: 0 });
    return;
  }

  const elapsed = now - gesture.at;
  const moved = Math.abs(top - gesture.top);

  gesture.top = top;
  gesture.at = now;

  /* A jump after a long pause is not a scroll gesture: it is a window opening
   * at a saved position, or content resizing under a fixed scroll offset. */
  if (elapsed > DETENT_IDLE_MS) {
    gesture.speed = 0;
    gesture.distance = 0;

    return;
  }

  gesture.distance += moved;

  // Two events inside the same clock tick tell us nothing about speed.
  if (elapsed <= 0 || gesture.distance < DETENT_PIXELS) {
    return;
  }

  const speed = (moved / elapsed) * 1000;

  gesture.speed = gesture.speed * DETENT_SPEED_SMOOTHING + speed * (1 - DETENT_SPEED_SMOOTHING);

  /* Keep the leftover travel, so notches stay evenly spaced however the browser
   * happens to chunk the movement, but never bank more than one notch of debt
   * from a fling. */
  gesture.distance = Math.min(gesture.distance - DETENT_PIXELS, DETENT_PIXELS);

  playDetent(gesture.speed);
}

/**
 * Moves the gesture to where the content now sits without sounding a detent. A
 * window resize reflows the content under a fixed viewport, so the scroll it
 * produces is not a gesture; recording it here stops the next real scroll from
 * reading the jump as travel.
 */
export function skipScroll(element: Element) {
  gestures.set(element, { top: element.scrollTop, at: performance.now(), speed: 0, distance: 0 });
}
