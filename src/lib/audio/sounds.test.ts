import { beforeEach, expect, test, vi } from "vitest";

import { schedulePlayback } from "./context.ts";
import { playErrorSound, playKeyDownSound, playKeyPressSound, playKeyUpSound, playSuccessSound } from "./sounds.ts";

vi.mock("./context.ts", () => ({ LEAD_TIME_S: 0, schedulePlayback: vi.fn() }));

beforeEach(() => {
  vi.mocked(schedulePlayback).mockClear();
});

// Each call schedules the sound again; caching the rendered buffer does not cache playback.
test.each([
  ["playKeyDownSound", playKeyDownSound],
  ["playKeyUpSound", playKeyUpSound],
  ["playKeyPressSound", playKeyPressSound],
  ["playErrorSound", playErrorSound],
  ["playSuccessSound", playSuccessSound],
])("%s plays its sound on every call", (_name, playSound) => {
  playSound();
  playSound();

  expect(vi.mocked(schedulePlayback).mock.calls.map(([callback]) => typeof callback)).toEqual(["function", "function"]);
});
