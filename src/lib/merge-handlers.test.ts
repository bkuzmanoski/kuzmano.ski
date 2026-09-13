import { describe, expect, test, vi } from "vitest";

import { mergeHandlers } from "./merge-handlers.ts";

import type { SyntheticEvent } from "react";

const event = { type: "pointerup" } as SyntheticEvent;

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

    merged.onPointerUp(event);

    expect(callOrder).toEqual(["first", "second"]);
  });

  test("retains the handlers that only one bag provides", () => {
    const onPointerDown = vi.fn();
    const onDoubleClick = vi.fn();
    const merged = mergeHandlers({ onPointerDown }, { onDoubleClick });

    merged.onPointerDown(event);
    merged.onDoubleClick(event);

    expect(onPointerDown).toHaveBeenCalledWith(event);
    expect(onDoubleClick).toHaveBeenCalledWith(event);
  });

  test("passes the event to every handler", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    mergeHandlers({ onPointerUp: firstHandler }, { onPointerUp: secondHandler }).onPointerUp(event);

    expect(firstHandler).toHaveBeenCalledWith(event);
    expect(secondHandler).toHaveBeenCalledWith(event);
  });

  test("calls the handler from the other bag when either bag is empty", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    mergeHandlers({ onPointerUp: firstHandler }, {}).onPointerUp(event);
    mergeHandlers({}, { onPointerUp: secondHandler }).onPointerUp(event);

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });
});
