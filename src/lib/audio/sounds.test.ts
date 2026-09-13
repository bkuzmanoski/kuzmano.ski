import { beforeEach, expect, test, vi } from "vitest";

import { playSound } from "./context.ts";
import { playError, playSuccess } from "./sounds.ts";

vi.mock("./context.ts", () => ({ LEAD_TIME_S: 0, playSound: vi.fn() }));

beforeEach(() => {
  vi.mocked(playSound).mockClear();
});

// Each call schedules the sound again; caching the rendered buffer does not cache playback.
test.each([
  ["playError", playError],
  ["playSuccess", playSuccess],
])("%s plays its sound on every call", (_name, play) => {
  play();
  play();

  expect(vi.mocked(playSound).mock.calls.map(([callback]) => typeof callback)).toEqual(["function", "function"]);
});
