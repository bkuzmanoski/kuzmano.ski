import { beforeEach, describe, expect, test, vi } from "vitest";

import { playSound } from "./context";
import { scrollSafeClickSoundHandlers } from "./ui";

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
