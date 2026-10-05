import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { playKeyPressSounds } from "./key-press-sounds.ts";
import { playKeyDownSound, playKeyUpSound } from "./sounds.ts";

import type * as AudioSounds from "./sounds.ts";

vi.mock("./sounds.ts", async (importActual) => ({
  ...(await importActual<typeof AudioSounds>()),
  playKeyDownSound: vi.fn(),
  playKeyUpSound: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(playKeyDownSound).mockClear();
  vi.mocked(playKeyUpSound).mockClear();
});

const KEY_A = { key: "a", code: "KeyA" };

const pressKeyA = (options?: Parameters<typeof playKeyPressSounds>[1]) =>
  playKeyPressSounds(new KeyboardEvent("keydown", KEY_A), options);

describe("playKeyPressSounds", () => {
  test("plays the key down sound, and plays the key up sound and calls `onRelease` with the key up event when the key is released", () => {
    const onRelease = vi.fn();

    pressKeyA({ onRelease });

    expect(playKeyDownSound).toHaveBeenCalledOnce();
    expect(playKeyUpSound).not.toHaveBeenCalled();

    fireEvent.keyUp(document, KEY_A);

    expect(playKeyUpSound).toHaveBeenCalledOnce();
    expect(onRelease).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: "keyup", code: "KeyA" }));
  });

  test("plays the key up sound only for the release of the key that was pressed, and only once", () => {
    pressKeyA();
    fireEvent.keyUp(document, { key: "b", code: "KeyB" });

    expect(playKeyUpSound).not.toHaveBeenCalled();

    fireEvent.keyUp(document, KEY_A);
    fireEvent.keyUp(document, KEY_A);

    expect(playKeyUpSound).toHaveBeenCalledOnce();
  });

  test("plays the key up sound on the release that follows the key's repeated key down events", () => {
    pressKeyA();
    fireEvent.keyDown(document, { ...KEY_A, repeat: true });
    fireEvent.keyUp(document, KEY_A);

    expect(playKeyUpSound).toHaveBeenCalledOnce();
  });

  test.each([
    ["the window loses focus", () => fireEvent.blur(window)],
    ["the key is pressed again without a release", () => fireEvent.keyDown(document, KEY_A)],
  ])("ends the press without playing the key up sound or calling `onRelease` when %s", (_, endPress) => {
    const onRelease = vi.fn();

    pressKeyA({ onRelease });
    endPress();
    fireEvent.keyUp(document, KEY_A);

    expect(playKeyUpSound).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });

  test("ends the press without playing the key up sound when `signal` is aborted", () => {
    const controller = new AbortController();

    pressKeyA({ signal: controller.signal });
    controller.abort();
    fireEvent.keyUp(document, KEY_A);

    expect(playKeyUpSound).not.toHaveBeenCalled();
  });
});
