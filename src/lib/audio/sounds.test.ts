import { beforeEach, describe, expect, test, vi } from "vitest";

import { playSound } from "./context.ts";
import { playError, playSuccess } from "./sounds.ts";

vi.mock("./context.ts", () => ({ LEAD_TIME: 0, playSound: vi.fn() }));

beforeEach(() => {
  vi.mocked(playSound).mockClear();
});

describe("error and success", () => {
  test.each([
    ["playError", playError],
    ["playSuccess", playSuccess],
  ])("%s plays its sound each time it is called", (_name, play) => {
    play();
    play();

    expect(playSound).toHaveBeenCalledTimes(2); // Each call schedules the sound again; caching the rendered buffer does not cache playback.
  });

  test("both play their sounds through the audio context", () => {
    playError();
    playSuccess();

    expect(playSound).toHaveBeenCalledTimes(2);
    expect(vi.mocked(playSound).mock.calls.every(([play]) => typeof play === "function")).toBe(true);
  });
});
