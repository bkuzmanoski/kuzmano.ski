import { beforeEach, describe, expect, test, vi } from "vitest";

import { playSound } from "./context";
import { playError, playSuccess, scrollSafeClickSoundHandlers } from "./sounds";

vi.mock("./context", () => ({ LEAD_TIME: 0, playSound: vi.fn() }));

beforeEach(() => {
  vi.mocked(playSound).mockClear();
});

describe("scrollSafeClickSoundHandlers", () => {
  test("a mouse press sounds on pointer down", () => {
    scrollSafeClickSoundHandlers.onPointerDown({ pointerType: "mouse" });

    expect(playSound).toHaveBeenCalledTimes(1);

    scrollSafeClickSoundHandlers.onPointerUp({ pointerType: "mouse" });

    expect(playSound).toHaveBeenCalledTimes(1);
  });

  test("a pen press sounds on pointer down", () => {
    scrollSafeClickSoundHandlers.onPointerDown({ pointerType: "pen" });
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  test("a touch press sounds on pointer up", () => {
    scrollSafeClickSoundHandlers.onPointerDown({ pointerType: "touch" });

    expect(playSound).not.toHaveBeenCalled();

    scrollSafeClickSoundHandlers.onPointerUp({ pointerType: "touch" });

    expect(playSound).toHaveBeenCalledTimes(1);
  });
});

describe("error and success", () => {
  // Each call schedules the sound again; caching the rendered buffer does not cache playback.
  test.each([
    ["playError", playError],
    ["playSuccess", playSuccess],
  ])("%s schedules a sound each time it is called", (_name, play) => {
    play();
    play();

    expect(playSound).toHaveBeenCalledTimes(2);
  });

  test("both play through the sound gate", () => {
    playError();
    playSuccess();

    expect(playSound).toHaveBeenCalledTimes(2);
    expect(vi.mocked(playSound).mock.calls.every(([play]) => typeof play === "function")).toBe(true);
  });
});
