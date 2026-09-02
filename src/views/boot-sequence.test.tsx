import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type * as AudioContext from "#/lib/audio/context";
import type * as AudioSounds from "#/lib/audio/sounds";
import { MINIMUM_LOADING_DURATION_MS } from "#/lib/boot-sequence/phases";

import { BootSequence } from "./boot-sequence";

const { primeAudio } = vi.hoisted(() => ({ primeAudio: vi.fn() }));

vi.mock("#/lib/audio/context", async (importActual) => ({
  ...(await importActual<typeof AudioContext>()),
  needsAudioPriming: () => true,
  primeAudio,
}));

vi.mock("#/lib/audio/sounds", async (importActual) => ({
  ...(await importActual<typeof AudioSounds>()),
  playBootChime: vi.fn(),
}));

beforeEach(() => {
  primeAudio.mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function renderWaitingForInput() {
  const view = render(<BootSequence />);

  await act(async () => {
    vi.advanceTimersByTime(MINIMUM_LOADING_DURATION_MS);
    await Promise.resolve();
  });

  return view;
}

test("a begin gesture primes audio while the sequence waits for input", async () => {
  await renderWaitingForInput();

  fireEvent.keyDown(document, { key: "Enter" });

  expect(primeAudio).toHaveBeenCalledOnce();
});

test("unmounting stops listening for the begin gesture", async () => {
  const { unmount } = await renderWaitingForInput();

  unmount();
  fireEvent.keyDown(document, { key: "Enter" });
  fireEvent.pointerUp(document);

  expect(primeAudio).not.toHaveBeenCalled();
});
