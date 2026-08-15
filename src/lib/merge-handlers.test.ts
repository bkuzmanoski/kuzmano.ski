import { describe, expect, test, vi } from "vitest";

import { mergeHandlers } from "./merge-handlers";

import type { SyntheticEvent } from "react";

const event = { type: "pointerup" } as SyntheticEvent;

describe("mergeHandlers", () => {
  test("runs a shared handler from both bags, in the order the bags are given", () => {
    const calls: Array<string> = [];
    const merged = mergeHandlers(
      {
        onPointerUp: (_event: SyntheticEvent) => {
          calls.push("first");
        },
      },
      {
        onPointerUp: (_event: SyntheticEvent) => {
          calls.push("second");
        },
      },
    );

    merged.onPointerUp(event);

    expect(calls).toEqual(["first", "second"]);
  });

  test("keeps the handlers only one bag names", () => {
    const onPointerDown = vi.fn();
    const onDoubleClick = vi.fn();
    const merged = mergeHandlers({ onPointerDown }, { onDoubleClick });

    merged.onPointerDown(event);
    merged.onDoubleClick(event);

    expect(onPointerDown).toHaveBeenCalledWith(event);
    expect(onDoubleClick).toHaveBeenCalledWith(event);
  });

  test("passes the event to every handler", () => {
    const first = vi.fn();
    const second = vi.fn();

    mergeHandlers({ onPointerUp: first }, { onPointerUp: second }).onPointerUp(event);

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
  });

  test("tolerates an empty bag on either side", () => {
    const first = vi.fn();
    const second = vi.fn();

    mergeHandlers({ onPointerUp: first }, {}).onPointerUp(event);
    mergeHandlers({}, { onPointerUp: second }).onPointerUp(event);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
