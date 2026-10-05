import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playBootChimeSound, playKeyDownSound, playKeyPressSound, playKeyUpSound } from "#/lib/audio/sounds.ts";
import { MIN_LOADING_DURATION_MS } from "#/lib/boot-sequence/phases.ts";

import { BootSequence } from "./boot-sequence.tsx";

const { primeAudio } = vi.hoisted(() => ({ primeAudio: vi.fn() }));

vi.mock("#/lib/audio/context.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {
    needsAudioPriming: () => true,
    primeAudio,
  }),
);

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => {
  primeAudio.mockClear();
  vi.mocked(playKeyDownSound).mockClear();
  vi.mocked(playKeyUpSound).mockClear();
  vi.mocked(playKeyPressSound).mockClear();
  vi.mocked(playBootChimeSound).mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function renderWaitingForInput() {
  const view = render(<BootSequence />);

  await act(async () => {
    vi.advanceTimersByTime(MIN_LOADING_DURATION_MS);
    await Promise.resolve();
  });

  return view;
}

test("pressing a key primes audio while the boot sequence waits for input", async () => {
  await renderWaitingForInput();

  fireEvent.keyDown(document, { key: "Enter" });

  expect(primeAudio).toHaveBeenCalledOnce();
});

test("pressing a key plays the key down sound, and releasing it plays the key up sound and begins the boot sequence", async () => {
  await renderWaitingForInput();

  fireEvent.keyDown(document, { key: "a", code: "KeyA" });

  expect(playKeyDownSound).toHaveBeenCalledOnce();
  expect(playBootChimeSound).not.toHaveBeenCalled();

  fireEvent.keyUp(document, { key: "a", code: "KeyA" });

  expect(playKeyUpSound).toHaveBeenCalledOnce();
  expect(playBootChimeSound).toHaveBeenCalledOnce();
});

test("holding a key until it repeats plays the key down sound once", async () => {
  await renderWaitingForInput();

  fireEvent.keyDown(document, { key: "a", code: "KeyA" });
  fireEvent.keyDown(document, { key: "a", code: "KeyA", repeat: true });

  expect(playKeyDownSound).toHaveBeenCalledOnce();
});

test("releasing a key that was pressed before the begin prompt appeared does not play the key up sound or begin the boot sequence", async () => {
  await renderWaitingForInput();

  fireEvent.keyUp(document, { key: "a", code: "KeyA" });

  expect(playKeyUpSound).not.toHaveBeenCalled();
  expect(playBootChimeSound).not.toHaveBeenCalled();
});

test("pressing and releasing a key with the Command key held does not prime audio, play a key sound, or begin the boot sequence, even when the Command key is released first", async () => {
  await renderWaitingForInput();

  fireEvent.keyDown(document, { key: "k", code: "KeyK", metaKey: true });
  fireEvent.keyUp(document, { key: "k", code: "KeyK" });

  expect(primeAudio).not.toHaveBeenCalled();
  expect(playKeyDownSound).not.toHaveBeenCalled();
  expect(playKeyUpSound).not.toHaveBeenCalled();
  expect(playBootChimeSound).not.toHaveBeenCalled();
});

test("pressing the mouse button primes audio and plays the key down sound, and releasing it plays the key up sound and begins the boot sequence", async () => {
  await renderWaitingForInput();

  fireEvent.pointerDown(document, { pointerType: "mouse" });

  expect(primeAudio).toHaveBeenCalledOnce();
  expect(playKeyDownSound).toHaveBeenCalledOnce();
  expect(playBootChimeSound).not.toHaveBeenCalled();

  fireEvent.pointerUp(document, { pointerType: "mouse" });

  expect(playKeyUpSound).toHaveBeenCalledOnce();
  expect(playBootChimeSound).toHaveBeenCalledOnce();
});

test("releasing the mouse button when it was pressed before the begin prompt appeared does not play the key up sound or begin the boot sequence", async () => {
  await renderWaitingForInput();

  fireEvent.pointerUp(document, { pointerType: "mouse" });

  expect(playKeyUpSound).not.toHaveBeenCalled();
  expect(playBootChimeSound).not.toHaveBeenCalled();
});

test("a tap primes audio, plays the key press sound, and begins the boot sequence on release rather than on press", async () => {
  await renderWaitingForInput();

  fireEvent.pointerDown(document, { pointerType: "touch" });

  expect(primeAudio).not.toHaveBeenCalled();
  expect(playKeyDownSound).not.toHaveBeenCalled();

  fireEvent.pointerUp(document, { pointerType: "touch" });

  expect(primeAudio).toHaveBeenCalledOnce();
  expect(playKeyPressSound).toHaveBeenCalledOnce();
  expect(playBootChimeSound).toHaveBeenCalledOnce();
});

test("unmounting stops listening for the begin gesture", async () => {
  const { unmount } = await renderWaitingForInput();

  unmount();
  fireEvent.keyDown(document, { key: "Enter" });
  fireEvent.pointerUp(document);

  expect(primeAudio).not.toHaveBeenCalled();
});
