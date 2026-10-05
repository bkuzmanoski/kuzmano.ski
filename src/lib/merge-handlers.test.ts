import { describe, expect, test, vi } from "vitest";

import { mergeHandlers } from "./merge-handlers.ts";

import type { SyntheticEvent } from "react";

const POINTER_UP_EVENT = { type: "pointerup" } as SyntheticEvent;

describe("mergeHandlers", () => {
  test("runs a shared handler from both bags, in the order the bags are given", () => {
    const callOrder: Array<string> = [];
    const merged = mergeHandlers(
      {
        onPointerUp: (_event: SyntheticEvent) => {
          callOrder.push("first");
        },
      },
      {
        onPointerUp: (_event: SyntheticEvent) => {
          callOrder.push("second");
        },
      },
    );

    merged.onPointerUp(POINTER_UP_EVENT);

    expect(callOrder).toEqual(["first", "second"]);
  });

  test("retains the handlers that only one bag provides", () => {
    const onPointerDown = vi.fn();
    const onDoubleClick = vi.fn();
    const merged = mergeHandlers({ onPointerDown }, { onDoubleClick });

    merged.onPointerDown(POINTER_UP_EVENT);
    merged.onDoubleClick(POINTER_UP_EVENT);

    expect(onPointerDown).toHaveBeenCalledWith(POINTER_UP_EVENT);
    expect(onDoubleClick).toHaveBeenCalledWith(POINTER_UP_EVENT);
  });

  test("passes the event to every handler", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    mergeHandlers({ onPointerUp: firstHandler }, { onPointerUp: secondHandler }).onPointerUp(POINTER_UP_EVENT);

    expect(firstHandler).toHaveBeenCalledWith(POINTER_UP_EVENT);
    expect(secondHandler).toHaveBeenCalledWith(POINTER_UP_EVENT);
  });

  test("calls the handler from the other bag when either bag is empty", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    mergeHandlers({ onPointerUp: firstHandler }, {}).onPointerUp(POINTER_UP_EVENT);
    mergeHandlers({}, { onPointerUp: secondHandler }).onPointerUp(POINTER_UP_EVENT);

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });
});
